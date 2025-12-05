from rest_framework import serializers
from core.models import HiddenPost, Community, Post, Chain, Message, UserProfile
from django.contrib.auth.models import User, Group
# import imghdr
from django.core.exceptions import ValidationError
from PIL import Image
import io
from pillow_heif import register_heif_opener
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Sum
from django.contrib.auth.tokens import default_token_generator
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from django.conf import settings
import urllib.parse
from django.utils.text import slugify
from django_otp.plugins.otp_totp.models import TOTPDevice
import re

USERNAME_REGEX = re.compile(r'^[a-zA-Z0-9_-]+$')  # only letters, numbers, and underscore

register_heif_opener()  # Enable HEIC support

# Notify Admins of a New Community Approval (New)
class CommunityApprovalRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False)
    slug = serializers.SlugField(required=False)
    title = serializers.CharField(max_length=255)
    status = serializers.CharField(default='pending', required=False)  # Add status field here

    def to_internal_value(self, data):
        # Set status to 'pending' if it's not provided
        if 'status' not in data:
            data['status'] = 'pending'

        return super().to_internal_value(data)

    def validate_slug(self, value):
        if not value:
            title = self.initial_data.get('title', '')
            value = slugify(title)

        # Ensure slug is unique
        unique_slug = value
        counter = 1
        while Community.objects.filter(slug=unique_slug).exists():
            unique_slug = f"{value}-{counter}"
            counter += 1

        # print(f"✅ Generated unique slug: {unique_slug}")
        self.slug = unique_slug  # Store in serializer instance
        return unique_slug

    def validate_email(self, value):
        # print("🔍 Validating email:", value)
        if value and not User.objects.filter(email=value).exists():
            # print("❌ Email not found:", value)
            raise serializers.ValidationError("No account found with this email.")
        if not value:
            value = 'support@axionnode.com'  # Default admin email for approval
        return value

    def send_approval_email(self, slug, user):
        # print("📧 Sending approval email...")

        email = 'support@axionnode.com'  # Ensure email is a valid string
        title = self.initial_data.get('title', 'Untitled Community')
        description = self.initial_data.get('description', 'No description provided.')

        # print(f"📌 New Community Request: {title} (Slug: {slug})")
        # print(f"📌 Description: {description}")

        # Generate a token for the user associated with the community
        token = default_token_generator.make_token(user)  # Use the authenticated user for token generation
        approval_url = f"https://axionnode.com/api/approve-community/{slug}/{token}/"

        if email:
            message = Mail(
                from_email=settings.SENDGRID_FROM_EMAIL,
                to_emails=[email],
                subject='Approve New Community Request',
                html_content=f"Someone has attempted to create a new Community called {title}. <br><br> Community Description: {description} <br><br> As an administrator, please click the link to approve it: <br><br> <a href={approval_url}>Approve Community</a>."
            )
            try:
                sg = SendGridAPIClient(settings.SENDGRID_API_KEY) 
                response = sg.send(message)
                # print(f"Email sent successfully: {response.status_code}")  # Debugging
            except Exception as e:
                print(f"Error sending email: {e}")

# Password reset REQUEST functionality
class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        # print("🔍 Validating email:", value)  # Debugging

        if not User.objects.filter(email=value).exists():
            # print("❌ Email not found:", value)  # Debug missing email
            raise serializers.ValidationError("No account found with this email.")  # Return this error to frontend

        return value

    def send_reset_email(self):
        # print("📧 Sending reset email to:", self.validated_data['email'])  # Debug email sending process
        email = self.validated_data["email"]

        # URL encode the email to ensure it's safely included in the URL
        encoded_email = urllib.parse.quote(email)

        user = User.objects.get(email=email)
        token = default_token_generator.make_token(user)
        reset_link = f"https://axionnode.com/reset-password?token={token}&email={encoded_email}"

        if email:
            message = Mail(
                from_email=settings.SENDGRID_FROM_EMAIL,
                to_emails=[email],
                subject='Password Reset Request',
                html_content=f"We have received a request to reset your AxionNode password. <br><br> If you have requested this, please click this link to reset your password: {reset_link} <br><br> If you have not requested a password reset on your AxionNode account, then please ignore this email."
            )
            try:
                sg = SendGridAPIClient(settings.SENDGRID_API_KEY) 
                response = sg.send(message)
                # print(f"Email sent successfully: {response.status_code}")  # Debugging
            except Exception as e:
                print(f"Error sending email: {e}")

# Password Reset Functionality 
class PasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, data):
        try:
            user = User.objects.get(email=data["email"])
        except User.DoesNotExist:
            raise serializers.ValidationError("Invalid email.")

        if not default_token_generator.check_token(user, data["token"]):
            raise serializers.ValidationError("Invalid or expired token.")

        return data

    def save(self):
        user = User.objects.get(email=self.validated_data["email"])
        user.set_password(self.validated_data["new_password"])
        user.save()

# ✅ Register Serializer (Updated to Handle UserProfile)
class RegisterSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        required=True,
        max_length=150,  # Django default
        error_messages={
            "required": "Error: Username is required.",  # Custom error for empty username
            "blank": "Error: Username cannot be blank.",  # Custom error for empty username
            "max_length": "Error: Username cannot exceed 150 characters."  # Custom error for max length
        }
    )

    password = serializers.CharField(
        write_only=True,
        min_length=8,
        max_length=32,
        error_messages={
            "min_length": "Error: Password must be at least 8 characters long.",
            "max_length": "Error: Passwords must 32 characters or less.",
            "blank": "Error: Password cannot be empty.",
            "required": "Error: Password is required."
        }
    )
    
    # profile_photo = serializers.ImageField(required=False)

    email = serializers.EmailField(
        required=True,
        allow_blank=False,
        max_length=254,  # Django default
        error_messages={
            "blank": "Error: Email cannot be empty.",
            "required": "Error: Email is required.",
            "invalid": "Error: Enter a valid email address.",
            "max_length": "Error: Email cannot exceed 254 characters."
        }
    )

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password')

    # Validate their username 
    def validate_username(self, value):
        value = value.strip().lower().replace(" ", "")

        # Check for valid characters
        # Reject usernames with invalid characters
        if not USERNAME_REGEX.match(value):
            raise serializers.ValidationError(
                "Username can only contain letters, numbers, and underscores. No spaces, emojis, or special characters."
            )

        if len(value) > 150:
            raise serializers.ValidationError("Username cannot exceed 150 characters.")

        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Error: This username is already taken.")

        return value

    # Validate their email
    def validate_email(self, value):
        # Normalize: lowercase and remove spaces
        value = value.strip().lower().replace(" ", "")

        # Length check
        if len(value) > 254:
            raise serializers.ValidationError("Email cannot exceed 254 characters.")

        # Empty check
        if not value.strip():
            raise serializers.ValidationError("Error: Email cannot be empty.")

        # Uniqueness check
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Error: This email is already registered.")

        return value

    def validate_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError("Error: Password must be at least 8 characters long.")
        if len(value) > 32:
            raise serializers.ValidationError("Error: Password cannot exceed 32 characters.")
        return value

    # def validate_profile_photo(self, value):
    #     allowed_types = ["image/jpeg", "image/png"]
    #     if hasattr(value, "content_type") and value.content_type not in allowed_types:
    #         raise serializers.ValidationError("Only JPEG and PNG images are allowed.")
    #     elif not hasattr(value, "content_type"):  # Fallback for in-memory files
    #         file_extension = value.name.split(".")[-1].lower()
    #         if file_extension not in ["jpg", "jpeg", "png"]:
    #             raise serializers.ValidationError("Invalid file format. Only JPG and PNG are allowed.")
    #     return value
    # def validate_profile_photo(self, value):
    #     allowed_types = ["image/jpeg", "image/png", "image/heic", "image/heif"]
        
    #     # Check file content type
    #     if hasattr(value, "content_type") and value.content_type not in allowed_types:
    #         raise serializers.ValidationError("Only JPEG, HEIC, and PNG images are allowed.")
        
    #     # Fallback: Check file extension
    #     file_extension = value.name.split(".")[-1].lower()
    #     if file_extension not in ["jpg", "jpeg", "png", "heic", "heif"]:
    #         raise serializers.ValidationError("Invalid file format. Only JPG, HEIC, and PNG images are allowed.")

    #     # ✅ Convert HEIC to JPEG if necessary
    #     if file_extension in ["heic", "heif"]:
    #         image = Image.open(value)
    #         output = io.BytesIO()
    #         image.convert("RGB").save(output, format="JPEG")
    #         output.seek(0)
            
    #         # Rename the file to have a .jpg extension
    #         value.file = output
    #         value.name = value.name.rsplit(".", 1)[0] + ".jpg"
    #         value.content_type = "image/jpeg"

    #     return value

    def validate(self, data):
        # print("Validated data: ", data)  # Debugging line
        return super().validate(data)
    
    def create(self, validated_data):
        password = validated_data.pop('password')

        # Normalize email and username again just in case
        # validated_data['email'] = validated_data['email'].strip().lower().replace(" ", "")
        # validated_data['username'] = validated_data['username'].strip().lower().replace(" ", "")
        validated_data['email'] = validated_data['email']  # already cleaned
        validated_data['username'] = validated_data['username']  # already cleaned

        user = User(**validated_data)
        user.set_password(password)
        user.save()

        contributor_group, _ = Group.objects.get_or_create(name="Contributor")
        user.groups.add(contributor_group)

        return user

class CommunitySerializer(serializers.ModelSerializer):
    follower_count = serializers.IntegerField(source='communityfollow_set.count', read_only=True)

    class Meta:
        model = Community
        fields = ['id', 'title', 'description', 'moderator', 'created_at', 'slug', 'status', 'follower_count']
        read_only_fields = ['id', 'moderator', 'created_at', 'slug']

    # print("Made it to serializer")

    def create(self, validated_data):
        try:
            # print("📌 Entering CommunitySerializer.create()")
            request = self.context.get('request')

            # Debugging: Log request context and validated data
            self._log_request_info(request, validated_data)

            if request and hasattr(request, 'user'):
                # print(f"🔹 Setting moderator to: {request.user}")
                validated_data['moderator'] = request.user
            else:
                # print("❌ No valid user found in request context.")
                raise serializers.ValidationError("No valid user found in request context.")

            # Set the status field to 'pending' by default if not provided
            if 'status' not in validated_data:
                print("🔹 'status' field not found in request data. Setting default to 'pending'.")
            validated_data.setdefault('status', Community.PENDING)  # Fix: Set to 'pending' instead of False

            # print(f"✅ Final validated_data before saving: {validated_data}")
            community = super().create(validated_data)
            # print(f"🎉 Community '{community.title}' created with slug '{community.slug}', Status: {community.status}")
            return community
        
        except Exception as e:
            if 'duplicate key value violates unique constraint' in str(e):
                raise serializers.ValidationError({
                    'title': "We're sorry, this exact Community name already exists. Please try another one."
                })
            raise serializers.ValidationError("An error occurred while creating the community.")

    def _log_request_info(self, request, validated_data):
        """ Logs the request context and validated data for debugging purposes. """
        print("\n---- DEBUG LOG ----")
        print(f"Request context: {request if request else 'No request context'}")
        if request and hasattr(request, 'user'):
            print(f"User: {request.user}")
        else:
            print("No user in request context.")
        print(f"Validated data before modification: {validated_data}")
        print("-------------------\n")

        # Log the request context
        if request:
            print(f"Request context: {request}")
            print(f"User: {request.user if hasattr(request, 'user') else 'No user in request'}")
        else:
            print("Error: No request context found.")

        # Log validated data before modification
        print(f"Validated data before modification: {validated_data}")

        print("-------------------\n")

class PostSerializerNew(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = ['id', 'community', 'author', 'title', 'content', 'image', 'created_at', 'vote_count']
        read_only_fields = ['id', 'created_at', 'vote_count']

    def create(self, validated_data):
        request = self.context['request']
        validated_data['author'] = request.user  # Automatically set the author field
        
        # Ensure the community is passed along with the data
        if 'community' not in validated_data:
            raise serializers.ValidationError({'community': 'This field is required.'})

        return super().create(validated_data)

# Core PostSerializer
class PostSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    community = serializers.SerializerMethodField()
    content_snippet = serializers.SerializerMethodField()  # ✅ Ensure content snippet is included
    vote_count = serializers.SerializerMethodField()  # Change from IntegerField to SerializerMethodField
    user_vote = serializers.SerializerMethodField()
    post_photo = serializers.ImageField(source='image', read_only=True)

    class Meta:
        model = Post
        fields = ['id', 'title', 'slug', 'content_snippet', 'content', 'vote_count', 'created_at', 'community', 'author', 'user_vote', 'post_photo']

    def validate_content(self, value):
        """Ensure post content does not exceed 2000 characters."""
        max_length = 2000
        if len(value) > max_length:
            raise serializers.ValidationError(f"Post content cannot exceed {max_length} characters.")
        return value
    
    def get_author(self, obj):
        """Return the author's ID and username"""
        return {
            'id': obj.author.id,
            'username': obj.author.username,
        }

    def get_community(self, obj):
        """Return the community's ID, title, and slug"""
        return {
            'id': obj.community.id,
            'title': obj.community.title, 
            'slug': obj.community.slug,
            'status': obj.community.status, 
        }
    
    def get_content_snippet(self, obj):
        """Return the first 300 characters of the post content"""
        return obj.content[:300]  # ✅ Ensures we return only a snippet

    def get_user_vote(self, obj):
        user = self.context['request'].user
        if not user.is_authenticated:
            return None
        vote = obj.votes.filter(user=user).first()
        if vote:
            return "upvote" if vote.vote_type == "up" else "downvote"
        return None

    def get_vote_count(self, obj):
        """Safely calculate the sum of votes on a post with logging."""
        vote_sum = obj.votes.aggregate(total=Sum('value'))
        vote_count = vote_sum['total'] if vote_sum['total'] is not None else 0
        
        # Log the vote count and post details
        # print(f"Calculating vote count for Post '{obj.title}' (ID: {obj.id}): {vote_count}")
        
        return vote_count
    
class ChainSerializer(serializers.ModelSerializer):
    class Meta:
        model = Chain
        fields = '__all__'

# Core Message Serializer 
class MessageSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    vote_count = serializers.SerializerMethodField()
    user_vote = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'content', 'author', 'chain', 'created_at', 'vote_count', 'user_vote']

    def get_author(self, obj):
        """Return author details safely."""
        if not obj.author:
            return None  # ✅ Avoid crash if author is missing
        
        user_profile = getattr(obj.author, 'userprofile', None)  # ✅ Handle missing userprofile
        return {
            'id': obj.author.id,
            'username': obj.author.username,
            'profile_photo': user_profile.profile_photo.url if user_profile and user_profile.profile_photo else None
        }

    # def get_user_vote(self, obj):
    #     user = self.context['request'].user
    #     vote = obj.votes.filter(user=user).first()
    #     return vote.vote_type if vote else None  # 'upvote', 'downvote', or None
    
    def get_user_vote(self, obj):
        user = self.context['request'].user
        if not user.is_authenticated:
            return None
        vote = obj.votes.filter(user=user).first()
        if vote:
            return "upvote" if vote.vote_type == "up" else "downvote"
        return None

    def get_vote_count(self, obj):
        """Calculate the vote count for each message."""
        total_votes = obj.votes.aggregate(total=Sum('value'))['total'] or 0
        return total_votes

# Message Serializer for Home page
class MessageSerializerHome(serializers.ModelSerializer):
    post_slug = serializers.SerializerMethodField()
    post_title = serializers.CharField(source="chain.post.title")
    author_username = serializers.CharField(source="author.username")
    user_vote = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'content', 'created_at', 'post_title', 'post_slug', 'author_username', 'user_vote']

    def get_post_slug(self, obj):
        return obj.chain.post.slug  # Assuming Message is related to Chain → Post
    
    def get_user_vote(self, obj):
        user = self.context['request'].user
        if not user.is_authenticated:
            return None
        vote = obj.votes.filter(user=user).first()
        if vote:
            return "upvote" if vote.vote_type == "up" else "downvote"
        return None

# Main user serializer 
class UserSerializer(serializers.ModelSerializer):
    profile_photo = serializers.ImageField(source='userprofile.profile_photo', read_only=True)  # ✅ Add this

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'profile_photo']  # ✅ Ensure `profile_photo` is included
    
    def get_profile_photo(self, obj):
        """Fetch profile photo safely and return full URL"""
        user_profile = getattr(obj, 'userprofile', None)  # Access the user profile
        if user_profile and user_profile.profile_photo:
            request = self.context.get('request')  # Ensures full URL
            return request.build_absolute_uri(user_profile.profile_photo.url) if request else user_profile.profile_photo.url
        return None  # Return None if no photo is found

# ✅ UserProfile Serializer
class UserProfileSerializer(serializers.ModelSerializer):
    # You can include the user fields you want (username, email, etc.)
    username = serializers.CharField(source='user.username')
    profile_photo = serializers.ImageField(source='user.profile.profile_photo')
    posts = serializers.SerializerMethodField() # Added Posts
    is_two_factor_enabled = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = ['username', 'profile_photo', 'notify_on_reply', 'preferred_theme', 'posts', 'is_two_factor_enabled']

    def get_is_two_factor_enabled(self, obj):
        return TOTPDevice.objects.filter(user=obj.user, confirmed=True).exists()
    
    def get_posts(self, obj):
        posts = Post.objects.filter(author=obj.user, status='active').order_by('-created_at')[:50]
        # Pass request context to the PostSerializer
        context = self.context  # This gives us access to the request context
        return PostSerializer(posts, many=True, context=context).data

# Edit Post Serializer 
class PostEditSerializer(serializers.ModelSerializer):
    post_photo = serializers.ImageField(write_only=True, required=False)

    class Meta:
        model = Post
        fields = ['title', 'content', 'post_photo']  # Only allow editing these fields

    def validate_title(self, value):
        if not value.strip():
            raise serializers.ValidationError("Post title cannot be empty.")
        if len(value) > 255:  # You can adjust this limit
            raise serializers.ValidationError("Post title cannot exceed 255 characters.")
        return value

    def validate_content(self, value):
        if not value.strip():
            raise serializers.ValidationError("Post content cannot be empty.")
        if len(value) > 2000:  # You can adjust this limit
            raise serializers.ValidationError("Post content cannot exceed 2000 characters.")
        return value
    
    def update(self, instance, validated_data):
        image = validated_data.pop('post_photo', None)
        if image:
            instance.image = image

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance

# ✅ User Profile Update Serializer
class UserProfileUpdateSerializer(serializers.ModelSerializer):
    # Add the fields for username and email from the related User model
    username = serializers.CharField(source='user.username', max_length=150, required=False)
    email = serializers.EmailField(source='user.email', required=False)
    profile_photo = serializers.ImageField(required=False)
    is_two_factor_enabled = serializers.SerializerMethodField()

    # Notification preferences
    notify_on_reply = serializers.BooleanField(required=False)
    preferred_theme = serializers.ChoiceField(choices=[('light', 'Light'), ('dark', 'Dark')], required=False)

    class Meta:
        model = UserProfile  # Use UserProfile model
        fields = ['username', 'email', 'profile_photo', 'is_two_factor_enabled', 'notify_on_reply', 'preferred_theme']
    
    def get_is_two_factor_enabled(self, obj):
        return TOTPDevice.objects.filter(user=obj.user, confirmed=True).exists()
    
    # Clean and validate username
    def validate_username(self, value):
        value = value.strip().lower().replace(" ", "")

        # Check for valid characters
        if not USERNAME_REGEX.match(value):
            raise serializers.ValidationError(
                "Username can only contain letters, numbers, and underscores. No spaces, emojis, or special characters."
            )

        if len(value) > 150:
            raise serializers.ValidationError("Username cannot exceed 150 characters.")

        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Error: This username is already taken.")

        return value

    # Clean and validate email
    def validate_email(self, value):
        value = value.strip().lower().replace(" ", "")
        if len(value) > 254:
            raise serializers.ValidationError("Error: Email cannot exceed 254 characters.")
        if not value.strip():
            raise serializers.ValidationError("Error: Email cannot be empty.")

        user = self.instance.user
        if User.objects.exclude(pk=user.pk).filter(email=value).exists():
            raise serializers.ValidationError("Error: This email is already registered.")
        return value
    
    # Update a character
    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})

        # Update UserProfile fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update User fields
        if user_data:
            user = instance.user
            for attr, value in user_data.items():
                # Run normalization again just in case
                if attr == 'username':
                    value = value.strip().lower().replace(" ", "")
                elif attr == 'email':
                    value = value.strip().lower().replace(" ", "")
                setattr(user, attr, value)
            user.save()

        return instance

# Delete account functionality
class DeleteAccountSerializer(serializers.Serializer):
    confirm = serializers.BooleanField()

    def validate_confirm(self, value):
        if not value:
            raise serializers.ValidationError("You must confirm account deletion.")
        return value

# Photos only 
# class UserProfilePhotoUpdateSerializer(serializers.ModelSerializer):
#     profile_photo = serializers.ImageField()

#     class Meta:
#         model = UserProfile
#         fields = ['profile_photo']

#     def validate_profile_photo(self, value):
#         allowed_types = ["image/jpeg", "image/png", "image/heic", "image/heif"]
        
#         # Check file content type
#         if hasattr(value, "content_type") and value.content_type not in allowed_types:
#             raise serializers.ValidationError("Only JPEG and PNG images are allowed.")
        
#         # Fallback: Check file extension
#         file_extension = value.name.split(".")[-1].lower()
#         if file_extension not in ["jpg", "jpeg", "png", "heic", "heif"]:
#             raise serializers.ValidationError("Invalid file format. Only JPG and PNG are allowed.")

#         # ✅ Convert HEIC to JPEG if necessary
#         if file_extension in ["heic", "heif"]:
#             image = Image.open(value)
#             output = io.BytesIO()
#             image.convert("RGB").save(output, format="JPEG")
#             output.seek(0)
            
#             # Rename the file to have a .jpg extension
#             value.file = output
#             value.name = value.name.rsplit(".", 1)[0] + ".jpg"
#             value.content_type = "image/jpeg"

#         return value

# class HiddenPostSerializer(serializers.ModelSerializer):
#     slug = serializers.ReadOnlyField(source='post.slug')  # Ensures slug is returned

#     class Meta:
#         model = HiddenPost
#         fields = ['slug']