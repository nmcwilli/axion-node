from django.db import models
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils.text import slugify
from django.db.models import Sum
import datetime
from django.db.models import Q

# UserProfile Model
class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile", unique=True)
    profile_photo = models.ImageField(upload_to="profile_photos/", blank=True, null=True)

    # User Preferences
    notify_on_reply = models.BooleanField(default=True)
    preferred_theme = models.CharField(max_length=10, choices=[('light', 'Light'), ('dark', 'Dark')], default='light')

    def __str__(self):
        return f"{self.user.username}'s profile"

# Automatically create UserProfile when a User is created
@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)

@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def save_user_profile(sender, instance, **kwargs):
    instance.profile.save()

# Community Model
class Community(models.Model):
    PENDING = 'pending'
    APPROVED = 'approved'
    STATUS_CHOICES = [
        (PENDING, 'Pending Approval'),
        (APPROVED, 'Approved'),
    ]

    title = models.CharField(max_length=255)
    description = models.TextField(max_length=1000)
    moderator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='moderated_communities')
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='joined_communities', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    slug = models.SlugField(unique=True, blank=True, null=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PENDING)

    def __str__(self):
        return self.title 
    
    def save(self, *args, **kwargs):
        if not self.slug and self.title:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)

# Community Follow tracking
class CommunityFollow(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    community = models.ForeignKey(Community, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'community')
    
    def __str__(self):
        return f'{self.user.username} follows {self.community.title}'

# Post Model
class Post(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('banned', 'Banned'),
    ]

    community = models.ForeignKey(Community, on_delete=models.CASCADE, related_name='posts')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='posts')
    content = models.TextField(max_length=2000)
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    image = models.ImageField(upload_to='post_images/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    vote_count = models.IntegerField(default=0)  # Can go negative for downvotes (CALCULATED DYNAMICALLY NOW)
    hidden_by_users_count = models.IntegerField(default=0)  # Track number of users who hide the post
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active') # status field to track post state

    # def get_vote_count(self):
    #     return self.votes.aggregate(total=Sum('value'))['total'] or 0

    # def upvote(self):
    #     """Increase vote count by 1."""
    #     self.vote_count += 1
    #     self.save(update_fields=['vote_count'])

    # def downvote(self):
    #     """Decrease vote count by 1."""
    #     self.vote_count -= 1
    #     self.save(update_fields=['vote_count'])

    # def save(self, *args, **kwargs):
    #     if not self.slug:
    #         self.slug = slugify(self.title)  # ✅ Generate slug from title
    #     super().save(*args, **kwargs)

    def save(self, *args, **kwargs):
        if not self.slug:
            # Generate the base slug from the title
            # slug_base = slugify(self.title)

            timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")  # Exact timestamp
            
            # Leave space for timestamp and possible counter (at least 20 chars reserved)
            max_title_length = 255 - (len(timestamp) + 1)  # 1 for the hyphen

            # Ensure we don't cut in the middle of a word
            truncated_title = self.title[:max_title_length].rsplit(' ', 1)[0] if len(self.title) > max_title_length else self.title

            # Generate slug
            slug_base = slugify(truncated_title)
            unique_slug = f"{slug_base}-{timestamp}"  # Default format

            # If a post with the same slug already exists, append a counter
            counter = 1
            while Post.objects.filter(slug=unique_slug).exists():
                unique_slug = f"{slug_base}-{timestamp}-{counter}"
                counter += 1

            self.slug = unique_slug

        super().save(*args, **kwargs)
    
    def __str__(self):
        return f'{self.title} by {self.author} in {self.community} ({self.vote_count} votes)'

# Chain Model
class Chain(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='chains')
    parent_message = models.ForeignKey('Message', null=True, blank=True, on_delete=models.CASCADE, related_name='child_chains')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Chain {self.id} for Post {self.post.id}'

# Message Model
# class Message(models.Model):
#     chain = models.ForeignKey(Chain, on_delete=models.CASCADE, related_name='messages')
#     author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='messages')
#     content = models.TextField()
#     parent_message = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='replies')
#     created_at = models.DateTimeField(auto_now_add=True)

#     def save(self, *args, **kwargs):
#         """ Automatically create a new chain if this is the first message for a post. """
#         if not self.chain_id:
#             post = self.parent_message.chain.post if self.parent_message else None
#             if post:
#                 chain = Chain.objects.create(post=post)
#                 self.chain = chain
#         super().save(*args, **kwargs)

#     def __str__(self):
#         return f'Message by {self.author} in Chain {self.chain.id}'
class Message(models.Model):
    chain = models.ForeignKey(Chain, on_delete=models.CASCADE, related_name='messages')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='messages')
    content = models.TextField(max_length=1000)
    parent_message = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='replies')
    created_at = models.DateTimeField(auto_now_add=True)
    vote_count = models.IntegerField(default=0) # Tracks total votes

    def save(self, *args, **kwargs):
        """ Automatically assign messages to the correct chain structure. """
        if not self.chain_id:
            post = self.parent_message.chain.post if self.parent_message else None
            
            if post:
                # Check if Chain 0 exists for this post
                chain_0 = post.chains.first()  # Assuming oldest chain is Chain 0

                if self.parent_message:
                    # If replying to an existing message, stay in the same chain
                    self.chain = self.parent_message.chain
                else:
                    if chain_0:
                        # If Chain 0 exists, use it for first responses
                        self.chain = chain_0
                    else:
                        # Otherwise, create Chain 0
                        self.chain = Chain.objects.create(post=post)

        super().save(*args, **kwargs)

    def __str__(self):
        return f'Message by {self.author} in Chain {self.chain.id}'
    
    # Update the message vote count 
    def update_vote_count(self):
        """ Recalculate and update vote count based on upvotes and downvotes. """
        total_votes = self.votes.aggregate(total=Sum('value'))['total'] or 0
        self.vote_count = total_votes
        self.save(update_fields=['vote_count'])

# Tracks vote count per message
class MessageVote(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    message = models.ForeignKey('Message', on_delete=models.CASCADE, related_name='votes')
    vote_type = models.CharField(max_length=5, choices=[('up', 'Upvote'), ('down', 'Downvote')])
    value = models.IntegerField()  # +1 for upvote, -1 for downvote

    class Meta:
        unique_together = ('user', 'message')  # Ensure a user can only vote once per message

    def __str__(self):
        return f"{self.user.username} voted {self.vote_type} on Message {self.message.id}"
    
# Vote Tracking for Posts per User 
class Vote(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='votes')  # ✅ Ensure related_name exists
    vote_type = models.CharField(max_length=5, choices=[('up', 'Upvote'), ('down', 'Downvote')])
    value = models.IntegerField()  # +1 for upvote, -1 for downvote

    class Meta:
        unique_together = ('user', 'post')  # Ensure a user can only vote once per post

# Tracks blocked users
class UserBlock(models.Model):
    blocker = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="blocking")
    blocked = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="blocked")

    class Meta:
        unique_together = ('blocker', 'blocked')

    def __str__(self):
        return f"{self.blocker} blocked {self.blocked}"

# Tracks hidden posts
class HiddenPost(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="hidden_posts")
    post = models.ForeignKey('Post', on_delete=models.CASCADE, related_name="hidden_by_users")

    class Meta:
        unique_together = ('user', 'post')

    def __str__(self):
        return f"{self.user} hid post {self.post.title}"

# Tracks Hidden Messages
class HiddenMessage(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='hidden_messages')
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='hidden_by_users')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'message')  # Prevent duplicate entries

# Post report tracking
class PostReport(models.Model):
    post = models.ForeignKey('Post', on_delete=models.CASCADE, related_name='reports')
    reported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('post', 'reported_by')  # Prevent duplicate reports from the same user

    def __str__(self):
        return f"Report by {self.reported_by} on {self.post.title}"