from django.contrib import admin
from .models import Community, Post, Chain, Message

# Django Admin for core SocialBook Modules

@admin.register(Community)
class CommunityAdmin(admin.ModelAdmin):
    list_display = ('title', 'moderator', 'created_at')
    search_fields = ('title', 'moderator__username')
    filter_horizontal = ('members',)

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ('content', 'community', 'author', 'created_at')
    search_fields = ('content', 'author__username', 'community__title')
    list_filter = ('community', 'created_at')

@admin.register(Chain)
class ChainAdmin(admin.ModelAdmin):
    list_display = ('id', 'post', 'parent_message', 'created_at')
    search_fields = ('post__content',)
    list_filter = ('post',)

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('content', 'author', 'chain', 'parent_message', 'created_at')
    search_fields = ('content', 'author__username')
    list_filter = ('chain', 'created_at')