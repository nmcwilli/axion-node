from django.shortcuts import render, get_object_or_404
from rest_framework import viewsets
from core.models import PostReport, UserBlock, HiddenPost, HiddenMessage, CommunityFollow, Community, Post, Chain, Message, UserProfile, Vote, MessageVote
from django.contrib.auth.models import User
from .serializers import DeleteAccountSerializer, MessageSerializerHome, CommunityApprovalRequestSerializer, PasswordResetSerializer, PasswordResetRequestSerializer, PostEditSerializer, PostSerializerNew, UserProfileSerializer, CommunitySerializer, PostSerializer, ChainSerializer, MessageSerializer, UserProfileUpdateSerializer, RegisterSerializer
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework import status, permissions, generics, serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.models import User
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.authentication import TokenAuthentication
from rest_framework.generics import RetrieveAPIView
from django.db.models import Q
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.generics import DestroyAPIView
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.http import HttpResponseBadRequest
from django.db.models import Prefetch
from rest_framework.permissions import IsAuthenticated
from django.db import transaction, IntegrityError
import requests
from bs4 import BeautifulSoup
from django.http import JsonResponse
from PIL import Image
from io import BytesIO
from django.core.files import File
from pillow_heif import register_heif_opener
from django.core.files.uploadedfile import InMemoryUploadedFile
import sys
from django.http import QueryDict
import traceback
from django.contrib.auth import authenticate
from django_otp import devices_for_user
from django_otp.plugins.otp_totp.models import TOTPDevice
import base64
import qrcode
import io
import re
from django.contrib.auth import get_user_model

register_heif_opener()  # Enables Pillow to handle HEIF/HEIC images

from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.exceptions import InvalidToken

User = get_user_model()

# Generate a OTP
class GenerateTOTPDeviceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user

        if user.totpdevice_set.filter(confirmed=True).exists():
            return Response({"detail": "TOTP device already confirmed"}, status=status.HTTP_400_BAD_REQUEST)

        # Optionally: Delete all existing unconfirmed devices to avoid clutter
        user.totpdevice_set.filter(confirmed=False).delete()

        # Create a single new unconfirmed device
        device = TOTPDevice.objects.create(user=user, confirmed=False, name="default")

        # Generate provisioning details
        otp_auth_url = device.config_url
        secret_key = device.bin_key.hex().upper()

        qr = qrcode.make(otp_auth_url)
        buffer = io.BytesIO()
        qr.save(buffer, format="PNG")
        qr_code_b64 = base64.b64encode(buffer.getvalue()).decode()

        return Response({
            "otp_auth_url": otp_auth_url,
            "secret_key": secret_key,
            "qr_code_b64": qr_code_b64,
        }, status=status.HTTP_201_CREATED)

# Confirm and enable the 2fa
class ConfirmTOTPDeviceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            user = request.user
            otp_token = request.data.get('otp_token')

            print(f"[DEBUG] User: {user}")
            print(f"[DEBUG] Received OTP token: {otp_token}")

            # Get the first unconfirmed device
            device = user.totpdevice_set.filter(confirmed=False).first()
            if not device:
                return Response({"detail": "No unconfirmed TOTP device found."}, status=status.HTTP_400_BAD_REQUEST)

            print(f"[DEBUG] Found unconfirmed device: {device}")

            if device.verify_token(otp_token):
                device.confirmed = True
                device.save()

                # Optionally: delete all other unconfirmed devices
                user.totpdevice_set.filter(confirmed=False).exclude(id=device.id).delete()

                return Response({"detail": "TOTP device confirmed."})
            else:
                # print("[ERROR] OTP token is invalid.")
                return Response({"detail": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            print("[EXCEPTION] An unexpected error occurred during 2FA confirmation:")
            traceback.print_exc()
            return Response({"detail": "Server error during 2FA confirmation."}, status=500)

class Disable2FAView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user

        confirmed_devices = user.totpdevice_set.filter(confirmed=True)
        if not confirmed_devices.exists():
            return Response({"detail": "2FA is not enabled."}, status=status.HTTP_400_BAD_REQUEST)

        confirmed_devices.delete()

        return Response({"detail": "Two-Factor Authentication has been disabled."}, status=status.HTTP_200_OK)

# This is the custom login view added for 2FA
class CustomLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username_or_email = request.data.get('username')
        password = request.data.get('password')

        # print(f"Received login attempt: {username_or_email}")
        # print(f"Password provided: ****")

        user = None

        if username_or_email:
            if re.match(r"[^@]+@[^@]+\.[^@]+", username_or_email):
                # print(f"Attempting to authenticate with email: {username_or_email}")
                try:
                    user_obj = User.objects.get(email=username_or_email)
                    # print(f"User found with email: {username_or_email}")
                    if user_obj.check_password(password):
                        # print(f"Password for user {username_or_email} is correct")
                        user = user_obj
                    else:
                        print(f"Invalid password for {username_or_email}")
                except User.DoesNotExist:
                    print(f"User with email {username_or_email} does not exist.")
            else:
                # print(f"Attempting to authenticate with username: {username_or_email}")
                user = authenticate(username=username_or_email, password=password)

        if user is None:
            # print(f"Authentication failed for {username_or_email}")
            return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

        # print(f"Authentication successful for {username_or_email}")

        if not user.is_active:
            # print(f"User account is disabled for {username_or_email}")
            return Response({"detail": "User account is disabled"}, status=status.HTTP_403_FORBIDDEN)

        # Check for 2FA requirement
        if any(device.confirmed for device in devices_for_user(user)):
            # print(f"2FA is required for {username_or_email}")
            return Response({"2fa_required": True, "username": user.username}, status=status.HTTP_200_OK)

        # print(f"No 2FA required. Generating tokens...")

        try:
            refresh = RefreshToken.for_user(user)
            access = refresh.access_token

            # print(f"token generated: {access}")
            # print(f"refreshToken generated: {refresh}")

            return Response({
                "refreshToken": str(refresh),
                "token": str(access)
            })
        except Exception as e:
            # print(f"Token creation failed: {e}")
            traceback.print_exc()
            return Response({"detail": "Token generation failed."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# This is the Verify 2FA code
class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        otp_code = request.data.get('otp') or request.data.get('otp_code')

        # print(f"Received OTP verification request for username: {username}")
        # print(f"Received OTP code: {otp_code}")

        if not otp_code:
            # print("OTP code missing from request.")
            return Response({"detail": "OTP code missing"}, status=status.HTTP_400_BAD_REQUEST)

        from django.contrib.auth import get_user_model
        User = get_user_model()

        try:
            user = User.objects.get(username=username)
            # print(f"User found: {user}")
        except User.DoesNotExist:
            # print("User does not exist.")
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        found_valid_token = False

        for device in devices_for_user(user):
            if device.confirmed and device.verify_token(otp_code):
                # print("OTP token is valid.")
                try:
                    refresh = RefreshToken.for_user(user)
                    access = refresh.access_token
                    return Response({
                        "refreshToken": str(refresh),
                        "token": str(access),
                    })
                except Exception as e:
                    print(f"Token generation failed: {e}")
                    return Response({"detail": "Token generation failed."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            else:
                print("OTP token is invalid or device not confirmed.")

        # print("No valid OTP token found for any device.")
        return Response({"detail": "Invalid OTP"}, status=status.HTTP_400_BAD_REQUEST)

# Enable 2FA for the first time
class EnableTOTPDeviceView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        if user.totpdevice_set.filter(confirmed=True).exists():
            return Response({"detail": "2FA already enabled."}, status=400)

        # Reuse Generate logic
        user.totpdevice_set.filter(confirmed=False).delete()
        device = TOTPDevice.objects.create(user=user, name="default", confirmed=False)

        return Response({
            "qr_code_url": device.config_url,
        })

# Verify 2FA status 
class TwoFactorStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        is_enabled = user.totpdevice_set.filter(confirmed=True).exists()
        return Response({"is_two_factor_enabled": is_enabled})

class CustomTokenRefreshView(TokenRefreshView):
    def post(self, request, *args, **kwargs):
        # print('Token refresh requested with data: %s', request.data)
        try:
            response = super().post(request, *args, **kwargs)
            # print('Token refresh success. Response: %s', response.data)
            return response
        except InvalidToken as e:
            # print('Invalid token during refresh attempt: %s', str(e))
            return Response({'detail': 'Token is invalid or expired'}, status=status.HTTP_401_UNAUTHORIZED)

# Helper method to handle vote creation or update
def handle_vote(user, post, vote_type, vote_value):
    existing_vote = Vote.objects.filter(user=user, post=post).first()

    if existing_vote:
        if existing_vote.vote_type == vote_type:
            return False  # User already voted this way
        existing_vote.vote_type = vote_type
        existing_vote.value = vote_value
        existing_vote.save()
    else:
        Vote.objects.create(user=user, post=post, vote_type=vote_type, value=vote_value)

    # Update post's vote count
    post.vote_count += vote_value if vote_type == 'up' else -vote_value
    post.save()
    return True

# Used when a user removes a Post Vote
class PostsRemoveVote(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, post_id):
        user = request.user
        post = get_object_or_404(Post, id=post_id)
        existing_vote = Vote.objects.filter(user=user, post=post).first()

        if not existing_vote:
            return Response({"detail": "You have not voted on this post"}, status=400)

        # Remove vote and update the post's vote count
        with transaction.atomic():
            post.vote_count -= existing_vote.value
            post.save()
            existing_vote.delete()

        return Response({"vote_count": post.vote_count}, status=200)

# Used when a user removes a Message Vote
class MessagesRemoveVote(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, message_id):
        user = request.user
        # print(f"User {user.id} ({user.username}) is attempting to remove a vote from message {message_id}")

        message = get_object_or_404(Message, id=message_id)
        existing_vote = MessageVote.objects.filter(user=user, message=message).first()

        if not existing_vote:
            # print(f"User {user.id} ({user.username}) attempted to remove a vote from message {message_id}, but no vote was found.")
            return Response({"detail": "You have not voted on this message"}, status=400)

        try:
            with transaction.atomic():
                vote_value = existing_vote.value  # Store the vote value before deletion
                # print(f"Removing vote (value={vote_value}) from message {message_id} by user {user.id}")

                existing_vote.delete()
                message.vote_count -= vote_value  # Ensure correct vote count update
                message.save()

                # print(f"Vote removed successfully. New vote count for message {message_id}: {message.vote_count}")

            return Response({"vote_count": message.vote_count}, status=200)

        except Exception as e:
            # print(f"Error while removing vote from message {message_id} by user {user.id}: {str(e)}", exc_info=True)
            return Response({"detail": "An error occurred while removing the vote"}, status=500)

# Used for Upvoting a Post 
class UpvotePostView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        user = request.user
        post = get_object_or_404(Post, slug=slug)

        with transaction.atomic():
            existing_vote = Vote.objects.filter(user=user, post=post).first()

            if existing_vote:
                if existing_vote.vote_type == 'up':
                    return Response({"detail": "You have already upvoted this post"}, status=400)
                elif existing_vote.vote_type == 'down':
                    # Switch vote from down to up
                    existing_vote.vote_type = 'up'
                    existing_vote.value = 1
                    existing_vote.save()
                    post.vote_count += 2  # Switch from -1 to +1 (net +2)
            else:
                Vote.objects.create(user=user, post=post, vote_type='up', value=1)
                post.vote_count += 1

            post.save()
        return Response({"vote_count": post.vote_count}, status=200)

# Used for Downvoting a Post 
class DownvotePostView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        user = request.user
        post = get_object_or_404(Post, slug=slug)
        existing_vote = Vote.objects.filter(user=user, post=post).first()

        if existing_vote:
            if existing_vote.vote_type == 'down':
                return Response({"detail": "You have already downvoted this post"}, status=400)
            elif existing_vote.vote_type == 'up':
                # Switch vote from up to down
                existing_vote.vote_type = 'down'
                existing_vote.value = -1
                existing_vote.save()
                post.vote_count -= 2  # Switch from +1 to -1 (net -2)
        else:
            Vote.objects.create(user=user, post=post, vote_type='down', value=-1)
            post.vote_count -= 1

        post.save()
        return Response({"vote_count": post.vote_count}, status=200)

# Notify Admins of a New Community
class CommunityApprovalRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # print("🔹 Received community approval request data:", request.data)

        serializer = CommunityApprovalRequestSerializer(data=request.data)
        if serializer.is_valid():
            # print("✅ Serializer valid. Sending approval email...")

            # Fetch the Community instance and the slug
            title = serializer.validated_data.get('title')
            community = get_object_or_404(Community, title=title)
            slug = community.slug  # Get the actual stored slug

            # Pass the user to the email sending function
            try:
                serializer.send_approval_email(slug=slug, user=request.user)  # Pass the authenticated user
            except Exception as e:
                # print(f"❌ Error during email sending: {e}")
                return Response({"message": "An error occurred while sending the email."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            return Response({"message": "An approval link has been sent to the admin."}, status=status.HTTP_200_OK)

        # print("❌ Serializer errors:", serializer.errors)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# Allows GET approval of new communities for Admins
class CommunityApprovalView(APIView):
    permission_classes = [AllowAny]  # Adjust permissions as necessary

    def get(self, request, slug, token):
        # print("🔹 Received approval request for community:", slug)

        try:
            # Fetch the community using the slug
            community = Community.objects.get(slug=slug)

            # Validate the token against the user who created the community (not the moderator)
            user = community.moderator  # The user who initiated the community creation
            if not default_token_generator.check_token(user, token):
                return Response({"detail": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)

            # Approve the community
            community.status = Community.APPROVED  # ✅ Correct field name
            community.save()

            return Response({"message": "Community has been approved successfully."}, status=status.HTTP_200_OK)

        except Community.DoesNotExist:
            return Response({"detail": "Community not found."}, status=status.HTTP_404_NOT_FOUND)

        except Exception as e:
            # print("Error:", e)
            return Response({"detail": "An error occurred."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Password Reset request view
class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # print("🔹 Received password reset request data:", request.data)  # Debugging

        serializer = PasswordResetRequestSerializer(data=request.data)
        if serializer.is_valid():
            print("✅ Serializer valid. Sending reset email...")
            serializer.send_reset_email()
            return Response({"message": "If this email exists, a reset link has been sent."}, status=status.HTTP_200_OK)

        # print("❌ Serializer errors:", serializer.errors)  # Debugging
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# Password Reset View 
class PasswordResetView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # print("🔹 Received password reset data:", request.data)  # Debug incoming request

        serializer = PasswordResetSerializer(data=request.data)
        if serializer.is_valid():
            # print("✅ Serializer valid. Saving new password...")
            serializer.save()
            return Response({"message": "Password has been reset successfully."}, status=status.HTTP_200_OK)

        # print("❌ Serializer errors:", serializer.errors)  # Debug validation errors
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# Register View
# ✅ Updated Register View to include profile photo handling
class RegisterView(APIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    # print("Reached the RegisterView")

    def post(self, request, *args, **kwargs):
        # print("Received request data: " + str(request.data))
        
        # Instantiate the serializer class explicitly
        serializer = self.serializer_class(data=request.data)

        # print("Received request data: " + str(serializer))
        
        if serializer.is_valid():
            # If valid, save user
            user = serializer.save()

            # Send a welcome email after successful registration
            # Check if email exists before sending
            if user.email:
                message = Mail(
                    from_email=settings.SENDGRID_FROM_EMAIL,
                    to_emails=[user.email],
                    subject='Welcome to Axion Node!',
                    html_content='Thank you for signing up for Axion Node. <br><br> \
                        This is an open-source platform for social communications. <br><br> \
                        Someone has invited you to this workspace. <br><br> \
                        Sincerely, <br> \
                        Axion Node'
                )
                try:
                    sg = SendGridAPIClient(settings.SENDGRID_API_KEY) 
                    response = sg.send(message)
                    print(f"Email sent successfully: {response.status_code}")  # Debugging
                except Exception as e:
                    print(f"Error sending email: {e}")

            return Response({"message": "User registered successfully."}, status=status.HTTP_201_CREATED)
        else:
            # print("Errors:", serializer.errors)  # To help debug the issues
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# Community Views for the API
class FollowCommunityView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        """Allow a user to follow a community"""
        community = get_object_or_404(Community, slug=slug)

        # Check if already following
        if CommunityFollow.objects.filter(user=request.user, community=community).exists():
            return Response({"detail": "Already following"}, status=status.HTTP_400_BAD_REQUEST)

        CommunityFollow.objects.create(user=request.user, community=community)
        return Response({"message": "Successfully followed"}, status=status.HTTP_201_CREATED)


class UnfollowCommunityView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        """Allow a user to unfollow a community"""
        community = get_object_or_404(Community, slug=slug)

        follow_instance = CommunityFollow.objects.filter(user=request.user, community=community)
        if follow_instance.exists():
            follow_instance.delete()
            return Response({"message": "Successfully unfollowed"}, status=status.HTTP_200_OK)

        return Response({"detail": "Not following this community"}, status=status.HTTP_400_BAD_REQUEST)

# Core View for the Community 
class CommunityListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # print("📌 GET request received for listing communities.")
        communities = Community.objects.all()
        # print("📌 Retrieved all objects")
        serializer = CommunitySerializer(communities, many=True)
        # print(f"✅ Returning {len(serializer.data)} communities.")
        return Response(serializer.data)

    def post(self, request):
        # print("📌 POST request received for creating a community.")
        # print(f"🔹 Request user: {request.user}")  # Debugging logged-in user
        # print(f"🔹 Request data: {request.data}")  # Debugging request payload

        serializer = CommunitySerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            # print("✅ Serializer is valid. Saving community...")
            community = serializer.save(moderator=request.user)
            # print(f"🎉 Community '{community.title}' created successfully with slug '{community.slug}'.")
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        # print("❌ Serializer errors:", serializer.errors)  # Debugging serializer errors
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# Community List used for New Posts
class CommunityListPostView(APIView):
    serializer_class = CommunitySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        followed_community_ids = CommunityFollow.objects.filter(user=user).values_list('community_id', flat=True)
        communities = Community.objects.filter(id__in=followed_community_ids)
        serializer = self.serializer_class(communities, many=True)
        return Response(serializer.data, status=200)

# ✅ Logout View
class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()  # Blacklist the refresh token

            return Response({"detail": "Successfully logged out."}, status=status.HTTP_205_RESET_CONTENT)
        except Exception:
            return Response({"error": "Invalid refresh token."}, status=status.HTTP_400_BAD_REQUEST)

# Posts View Home Page
class HomePostsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        posts = Post.objects.filter(status='active').order_by('-created_at')[:50]  # Get latest 50 posts
        return Response({"posts": PostSerializer(posts, many=True).data})

# Post Delete
# class PostDeleteView(DestroyAPIView):
#     queryset = Post.objects.all()
#     permission_classes = [permissions.IsAuthenticated, permissions.IsAuthenticatedOrReadOnly]

#     def delete(self, request, *args, **kwargs):
#         post = self.get_object()
#         if post.author != request.user:
#             return Response({"detail": "You do not have permission to delete this post."}, status=status.HTTP_403_FORBIDDEN)
#         self.perform_destroy(post)
#         return Response({"detail": "Post deleted successfully."}, status=status.HTTP_204_NO_CONTENT)
# Customized to also delete all of the Chains and associated Messages
class PostDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def delete(self, request, slug, *args, **kwargs):
        # print(f"Attempting to delete post with slug: {slug}")
        post = get_object_or_404(Post, slug=slug)
        # print(f"Post found: {post}")

        # Check if the user is the author of the post
        if post.author != request.user:
            print(f"User {request.user} is not the author of the post.")
            return Response({"detail": "You do not have permission to delete this post."}, status=status.HTTP_403_FORBIDDEN)
        
        # Delete associated chains and messages
        chains = post.chains.all()  # Use the 'chains' related name
        # print(f"Found {chains.count()} chains associated with this post.")
        
        for chain in chains:
            # print(f"Deleting messages for chain: {chain.id}")
            messages = chain.messages.all()
            # print(f"Found {messages.count()} messages to delete.")
            messages.delete()  # Deletes all messages under the chain
            # print(f"Deleting chain: {chain.id}")
            chain.delete()  # Deletes the chain itself
        
        # Delete the post
        # print(f"Deleting post: {post.title} (ID: {post.id})")
        post.delete()
        
        # Removed return detail because it was causing issues with fetch
        # return Response({"detail": "Post and associated chains/messages deleted successfully."}, status=status.HTTP_204_NO_CONTENT)
        return Response(status=status.HTTP_204_NO_CONTENT)

# Post Edit View
class PostEditView(generics.UpdateAPIView):
    queryset = Post.objects.filter(status='active')
    serializer_class = PostEditSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "slug"

    def get_object(self):
        post = super().get_object()
        if post.author != self.request.user:
            raise PermissionDenied("You are not allowed to edit this post.")
        return post

    def update(self, request, *args, **kwargs):
        try:
            post = self.get_object()
            # print(f"User '{request.user}' is attempting to edit post '{post.slug}'")

            # Avoid deepcopy that breaks FILES
            data = request.data

            # Validate title/content
            title = data.get("title", "").strip()
            content = data.get("content", "").strip()

            if not title:
                raise ValidationError({"title": "Post title cannot be empty."})
            if not content:
                raise ValidationError({"content": "Post content cannot be empty."})
            if len(content) > 2000:
                raise ValidationError({"content": "Post content cannot exceed 2000 characters."})
            if len(title) > 255:
                raise ValidationError({"title": "Post title cannot exceed 255 characters."})

            # Handle image
            post_photo = request.FILES.get("post_photo")
            # print(f"[update] post_photo received: {post_photo}")
            if post_photo:
                try:
                    # print(f"[update] Validating uploaded image...")

                    allowed_types = ["image/jpeg", "image/png", "image/heic", "image/heif"]
                    if post_photo.content_type not in allowed_types:
                        raise ValidationError({"post_photo": "Invalid file format."})
                    if post_photo.size == 0:
                        raise ValidationError({"post_photo": "Uploaded file is empty."})

                    # print("[update] Opening image...")
                    image = Image.open(post_photo)

                    max_width = 1200
                    width_percent = max_width / float(image.size[0])
                    height_size = int(float(image.size[1]) * width_percent)
                    image = image.resize((max_width, height_size), Image.Resampling.LANCZOS)

                    # Determine safe format
                    original_format = (image.format or "").upper()

                    # Fix: if the image has an alpha channel, never save as JPEG
                    # Images with alpha MUST be PNG
                    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
                        image_format = "PNG"
                    else:
                        if original_format in ["JPEG", "JPG"]:
                            image_format = "JPEG"
                        elif original_format in ["PNG"]:
                            image_format = "PNG"
                        else:
                            # HEIC / HEIF / unknown
                            image_format = "JPEG"

                    # Save correctly
                    image_io = BytesIO()
                    image.save(image_io, format=image_format)
                    image_io.seek(0)

                    extension = "png" if image_format == "PNG" else "jpg"
                    resized_image_file = File(image_io, name=f"{post_photo.name}_resized.{extension}")
                    data["post_photo"] = resized_image_file

                except Exception as e:
                    # print(f"[update] Image processing failed: {e}")
                    traceback.print_exc()
                    raise ValidationError({"post_photo": "Failed to process image."})

            # print("[update] Creating serializer...")
            serializer = self.get_serializer(post, data=data, partial=True)
            # print("[update] Validating serializer...")
            serializer.is_valid(raise_exception=True)
            # print("[update] Saving serializer...")
            serializer.save()
            # print("[update] Done updating.")

            return Response(serializer.data)

        except Exception as e:
            # print(f"[update] Unexpected error: {e}")
            traceback.print_exc()
            return Response({"detail": "Something went wrong."}, status=500)

# Post Detail View 
class PostDetailView(RetrieveAPIView):
    queryset = Post.objects.filter(status='active')
    serializer_class = PostSerializer
    lookup_field = "slug"
    permission_classes = [AllowAny]  # ✅ Anyone can view

# View for the CommunityDetailView which shows the Posts 
class CommunityDetailView(APIView):
    serializer_class = CommunitySerializer
    lookup_field = "slug"
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Community.objects.all()

    def get(self, request, slug):
        community = get_object_or_404(self.get_queryset(), slug=slug)
        posts = Post.objects.filter(
            community=community,
            status='active'  # ✅ Only show active posts
        ).order_by('-created_at')  # Sort by most recent

        community_data = self.serializer_class(community, context={'request': request}).data 
        posts_data = PostSerializer(posts, many=True, context={'request': request}).data 

        return Response({
            "community": community_data,
            "posts": posts_data
        }, status=status.HTTP_200_OK)

class UnfollowCommunityView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        """Allow a user to unfollow a community"""
        community = get_object_or_404(Community, slug=slug)
        user = request.user

        # Check if the user is following
        follow_instance = CommunityFollow.objects.filter(user=user, community=community)
        if follow_instance.exists():
            follow_instance.delete()
            return Response({"message": "Successfully unfollowed"}, status=status.HTTP_200_OK)

        return Response({"detail": "Not following this community"}, status=status.HTTP_400_BAD_REQUEST)

class FollowCommunityView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        """Allow a user to follow a community"""
        community = get_object_or_404(Community, slug=slug)
        user = request.user

        # Check if already following
        if CommunityFollow.objects.filter(user=user, community=community).exists():
            return Response({"detail": "Already following"}, status=status.HTTP_400_BAD_REQUEST)

        # Create follow entry
        CommunityFollow.objects.create(user=user, community=community)
        return Response({"message": "Successfully followed"}, status=status.HTTP_201_CREATED)

# Home page view - for UNauthenticated users 
class PublicPostListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        posts = Post.objects.filter(
            community__status=Community.APPROVED,
            status='active'
        ).order_by('-created_at')[:20]  # Only latest 20

        serializer = PostSerializer(posts, many=True, context={'request': request})
        return Response(serializer.data)

# Home Page View - For authenticated users 
class HomePostListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        followed_communities = CommunityFollow.objects.filter(user=user).values_list('community', flat=True)

        # followed_communities = CommunityFollow.objects.filter(user=user).values_list('community', flat=True)
        # Filter posts by followed communities and approved communities
        posts = Post.objects.filter(
            community_id__in=followed_communities, 
            community__status=Community.APPROVED,  # ✅ Correct field name
            status='active'  # ✅ Only show active posts
        ).order_by('-created_at')

        # posts = Post.objects.filter(community_id__in=followed_communities).order_by('-created_at')
        serializer = PostSerializer(posts, many=True, context={'request': request})
        return Response(serializer.data)

# Validate a users tokens to ensure they are still good
class ValidateTokenView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({'detail': 'Token is valid'}, status=status.HTTP_200_OK)

# ✅ User Profile View
class UserProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = request.user.profile
        # Pass the profile instance to the serializer, not profile.user
        serializer = UserProfileUpdateSerializer(profile, many=False)  # Updated line here
        return Response(serializer.data)

    def put(self, request):
        profile = request.user.profile
        # Pass the profile instance to the serializer, not profile.user
        serializer = UserProfileUpdateSerializer(profile, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Profile updated successfully!"}, status=status.HTTP_200_OK)
        
        # Get errors and format them
        error_messages = serializer.errors
        error_message = "\n".join([f"{field}: {', '.join(messages)}" for field, messages in error_messages.items()])

        return Response({"message": f"Error: {error_message}"}, status=status.HTTP_400_BAD_REQUEST)
    
    def patch(self, request):
        print("Received PATCH request data:", request.data)  # Log incoming request data

        profile = request.user.profile
        serializer = UserProfileUpdateSerializer(profile, data=request.data, partial=True)

        if serializer.is_valid():
            print("Serializer is valid. Validated data:", serializer.validated_data)
            serializer.save()
            print("Profile updated successfully.")
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        # Log validation errors if any
        print("Serializer errors:", serializer.errors)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Response to Posts View
# Creates a New Chain for Each Response to a Post
class RespondToPostView(APIView):
    """Creates a new chain for each direct response to a post."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        post = get_object_or_404(Post, slug=slug)
        content = request.data.get('content', '').strip()

        if not content:
            return Response({"detail": "Response cannot be empty."}, status=400)

        # Create a new chain for this response
        new_chain = Chain.objects.create(post=post)

        # Add the first message to the new chain
        message = Message.objects.create(author=request.user, chain=new_chain, content=content)

        # Send email notification to the post author (if the responder is not the author)
        post_author = post.author

        # print("Post author email detected as: " + post_author.email)

        if (
            post_author.email and 
            post_author != request.user and 
            getattr(post_author.profile, 'notify_on_reply', True)  # Default to True if profile missing
        ):
            email_subject = f"New response to your post: {post.title}"
            email_content = f"""
                Hello {post_author.username},<br><br>
                <strong>{request.user.username}</strong> just responded to your post titled "<strong>{post.title}</strong>" on Axion Node.<br><br>
                <blockquote>{content}</blockquote><br>
                <a href="https://axionnode.com/post/{post.slug}">View the response</a><br><br>
                – Axion Node
            """
            try:
                message_obj = Mail(
                    from_email=settings.SENDGRID_FROM_EMAIL,
                    to_emails=[post_author.email],
                    subject=email_subject,
                    html_content=email_content
                )
                sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
                sg.send(message_obj)
            except Exception as e:
                print(f"Failed to send response email to post author: {e}")

        return Response({
            "message_id": message.id,
            "chain_id": new_chain.id,
            "detail": "Response posted in a new chain!"
        }, status=201)

# Responses to Chain Messages
class RespondToChainView(APIView):
    """Responds to an existing chain under a post. Creates a new message in the specified chain."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug, chain_id):
        # Get the post and chain based on the slug and chain_id
        post = get_object_or_404(Post, slug=slug)
        # chain = get_object_or_404(Chain, post=post, chain_id=chain_id) -- Incorrect
        chain = get_object_or_404(Chain, post=post, id=chain_id)

        content = request.data.get('content', '').strip()

        if not content:
            return Response({"detail": "Content cannot be empty."}, status=400)

        # Create the new message under the specified chain
        message = Message.objects.create(author=request.user, chain=chain, content=content)

        return Response({
            "message_id": message.id,
            "chain_id": chain.id,
            "detail": f"Response posted in chain {chain.id}!"
        }, status=201)

# Loads the user profile data 
class UserProfileByUsernameView(APIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, username):
        # Get the user based on the provided username
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({"detail": "User is not found."}, status=404)

        # Check if the user has a profile
        try:
            user_profile = UserProfile.objects.get(user=user)
        except UserProfile.DoesNotExist:
            return Response({"detail": "User profile not found."}, status=404)

        # Serialize the user profile
        serializer = UserProfileSerializer(user_profile, context={"request": request})

        return Response(serializer.data)

# Delete Account View
class DeleteAccountView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, *args, **kwargs):
        print("Delete account request received.")
        
        serializer = DeleteAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        print("Request data validated.")

        user = request.user
        user_id = user.id
        original_email = user.email
        print(f"Target user: ID={user_id}, username={user.username}, email={original_email}")

        # Send confirmation email to user BEFORE changing the email
        if original_email:
            print("Preparing email notifications...")

            user_message = Mail(
                from_email=settings.SENDGRID_FROM_EMAIL,
                to_emails=[original_email],
                subject='Your Axion Node account has been deleted',
                html_content="""
                    Hello,<br><br>
                    This email is to confirm that your AxionNode account has been permanently deleted.<br><br>
                    If this was not initiated by you, please contact our support team immediately at support@axionnode.com.<br><br>
                    Thank you,<br>
                    Axion Node
                """
            )

            support_message = Mail(
                from_email=settings.SENDGRID_FROM_EMAIL,
                to_emails=["support@axionnode.com"],
                subject='[Alert] A user has deleted their account',
                html_content=f"""
                    Hello Support Team,<br><br>
                    The following user has deleted their account:<br><br>
                    <strong>User ID:</strong> {user_id}<br>
                    <strong>Username before deletion:</strong> {user.username}<br><br>
                    This is an automated notification.<br><br>
                    Regards,<br>
                    Axion Node
                """
            )

            try:
                sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
                response_user = sg.send(user_message)
                response_support = sg.send(support_message)
                print(f"User deletion email sent: {response_user.status_code}")
                print(f"Support notification sent: {response_support.status_code}")
            except Exception as e:
                print(f"Error sending email(s): {e}")

        # Anonymize and deactivate user account
        print("Anonymizing and deactivating user account...")
        try:
            user.username = f"deleted_user_{user_id}"
            user.email = f"deleted_account_{user_id}@axionnode.com"
            user.set_unusable_password()
            user.first_name = ""
            user.last_name = ""
            user.is_active = False

            if hasattr(user, 'profile_photo'):
                if user.profile_photo:
                    print("Deleting user profile photo...")
                    user.profile_photo.delete(save=False)
                else:
                    print("No profile photo to delete.")
            else:
                print("User has no profile_photo attribute.")

            user.save()
            print(f"User {user_id} anonymized and deactivated successfully.")
        except Exception as e:
            print(f"Error updating user info: {e}")
            raise  # This will still trigger the 500 so you can see full traceback

        return Response(status=status.HTTP_204_NO_CONTENT)

# Profile Photo Updater
class UserProfilePhotoUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        # print("🔹 Received POST request for updating profile photo")

        try:
            profile = request.user.profile
            # print(f"🔹 Authenticated User: {request.user.id} ({request.user.username})")

            if "profile_photo" not in request.FILES:
                # print("❌ No profile photo provided in request.")
                return Response({"message": "No profile photo provided."}, status=status.HTTP_400_BAD_REQUEST)

            profile_photo = request.FILES["profile_photo"]
            # print(f"🔹 Received file: {profile_photo.name} | Type: {profile_photo.content_type} | Size: {profile_photo.size} bytes")

            if profile_photo.size == 0:
                # print("❌ Uploaded file is empty (0 bytes).")
                return Response({"message": "Uploaded file is empty."}, status=status.HTTP_400_BAD_REQUEST)

            # Check MIME type
            allowed_types = ["image/jpeg", "image/png", "image/heic", "image/heif"]
            if profile_photo.content_type not in allowed_types:
                # print(f"❌ Unsupported file type: {profile_photo.content_type}")
                return Response({"message": "Invalid file format. Only JPG, PNG, and HEIC are allowed."}, status=status.HTTP_400_BAD_REQUEST)

            # Open image with Pillow
            image = Image.open(profile_photo)

            # Resize image
            max_width = 600
            width_percent = (max_width / float(image.size[0]))
            height_size = int((float(image.size[1]) * float(width_percent)))
            image = image.resize((max_width, height_size), Image.Resampling.LANCZOS)

            # Convert HEIC to JPEG if needed
            # Ensure the format is recognized
            image_format = image.format if image.format else "JPEG"
            if image_format not in ["JPEG", "PNG", "HEIF", "HEIC"]:
                raise ValueError(f"Unsupported image format: {image_format}")

            # Save the resized image to a BytesIO buffer
            image_io = BytesIO()
            image.save(image_io, format=image_format)
            image_io.seek(0)

            # Save the resized image to the model (or upload it to a storage service like S3)
            file_extension = "jpg" if image_format == "JPEG" else image_format.lower()
            profile.profile_photo.save(f"{profile_photo.name}_resized.{file_extension}", File(image_io), save=True)
            # print("✅ Profile photo saved successfully.")

            # Return updated profile photo URL
            profile_photo_url = profile.profile_photo.url if profile.profile_photo else None
            return Response({"message": "Profile photo updated successfully!", "profile_photo": profile_photo_url}, status=status.HTTP_200_OK)

        except Exception as e:
            print(f"❌ Unexpected error: {str(e)}")
            return Response({"message": f"Internal server error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        # Perform the default validation to get the data (including the token)
        data = super().validate(attrs)
        
        # Access the request context here
        request = self.context.get('request')
        
        if not request:
            raise ValueError("Request context is not available. Ensure the serializer is initialized with the request.")

        return data

class ChangePasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, min_length=8)

# ✅ Change Password View
class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request):
        user = request.user
        new_password = request.data.get("new_password")

        if not new_password or len(new_password) < 8:
            return Response({"error": "Password must be at least 8 characters long."}, status=400)

        user.set_password(new_password)
        user.save()
        update_session_auth_hash(request, user)  # Keep the user logged in after changing the password

        return Response({"detail": "Password updated successfully."}, status=status.HTTP_200_OK)

# Follow Status View
class FollowStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug):
        """Check if the current user is following the community"""
        community = get_object_or_404(Community, slug=slug)
        is_following = CommunityFollow.objects.filter(user=request.user, community=community).exists()
        
        return Response({"following": is_following}, status=status.HTTP_200_OK)

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

# Core Posts View Set
class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.filter(status='active')
    serializer_class = PostSerializer
    parser_classes = (MultiPartParser, FormParser)  # ✅ Required for image uploads
    permission_classes = [permissions.IsAuthenticated]

    # When a create request is used
    def create(self, request, *args, **kwargs):
        # print(f"Request data: {request.data}")  # Log the incoming data
        return super().create(request, *args, **kwargs)

    # ✅ Automatically assign author
    def perform_create(self, serializer):
        print(f"Saving post by author: {self.request.user.id}")
        user = self.request.user
        data = self.request.data

        # print(f"[perform_create] Request data received: {data}")
        
        # Ensure community field is present in request data
        community_id = data.get('community')
        if not community_id:
            raise serializers.ValidationError({'community': 'Community field is required.'})

        # Check if the community exists and is approved
        community = Community.objects.filter(id=community_id).first()
        if not community:
            raise ValidationError({'community': 'Community does not exist.'})
        if community.status != Community.APPROVED:  # ✅ Use correct field name
            raise ValidationError({'community': 'Community is not approved yet.'})
        
        # ✅ Image upload handling
        post_photo = self.request.FILES.get("post_photo")
        # print(f"[perform_create] post_photo received: {post_photo}")
        if post_photo:
            # print(f"[perform_create] Validating uploaded image...")
            # Validate MIME type
            allowed_types = ["image/jpeg", "image/png", "image/heic", "image/heif"]
            if post_photo.content_type not in allowed_types:
                # print(f"[perform_create] Invalid image type: {post_photo.content_type}")
                raise ValidationError({"post_photo": "Invalid file format. Only JPG, PNG, and HEIC are allowed."})

            if post_photo.size == 0:
                # print("[perform_create] Uploaded file is empty.")
                raise ValidationError({"post_photo": "Uploaded file is empty."})

            # Open image
            # print(f"[perform_create] Opening and processing image...")
            image = Image.open(post_photo)
            
            # Resize
            max_width = 1200
            width_percent = max_width / float(image.size[0])
            height_size = int((float(image.size[1]) * float(width_percent)))
            image = image.resize((max_width, height_size), Image.Resampling.LANCZOS)

            # Convert HEIC/HEIF to JPEG if needed
            image_format = image.format if image.format else "JPEG"
            if image_format.upper() in ["HEIC", "HEIF"]:
                # print(f"[perform_create] Converting {image_format} to JPEG")
                image_format = "JPEG"

            # Save to BytesIO
            image_io = BytesIO()
            image.save(image_io, format=image_format)
            image_io.seek(0)

            # Construct file name
            extension = "jpg" if image_format == "JPEG" else image_format.lower()
            image_file = File(image_io, name=f"{post_photo.name}_resized.{extension}")
            # print(f"[perform_create] Final image file ready: {image_file.name}")

            # Save post with image
            serializer.save(author=user, community_id=community_id, status='active', image=image_file)
            # print(f"[perform_create] Post saved with image.")
        else:
            # No image uploaded
            # print(f"[perform_create] No image uploaded, saving post without image.")
            serializer.save(author=user, community_id=community_id, status='active')
            
            # print(f"[perform_create] Post saved without image.")

    # Upvote a post
    @action(detail=True, methods=['post'])
    def upvote(self, request, pk=None):
        """Handles upvoting a post."""
        # print(f"Upvote requested for post ID: {pk}")
        post = self.get_object()
        post.upvote()
        # print(f"Post ID {pk} upvoted. New vote count: {post.vote_count}")
        return Response({'message': 'Upvoted successfully', 'vote_count': post.vote_count}, status=status.HTTP_200_OK)

    # Downvote a post 
    @action(detail=True, methods=['post'])
    def downvote(self, request, pk=None):
        """Handles downvoting a post."""
        # print(f"Downvote requested for post ID: {pk}")
        post = self.get_object()
        post.downvote()
        # print(f"Post ID {pk} downvoted. New vote count: {post.vote_count}")
        return Response({'message': 'Downvoted successfully', 'vote_count': post.vote_count}, status=status.HTTP_200_OK)
    
    # Exclude messages from blocked users
    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Post.objects.filter(status='active')  # ✅ Only return active posts for unauthenticated users

        # Get IDs of blocked users
        blocked_users = UserBlock.objects.filter(blocker=user).values_list('blocked', flat=True)

        # Get IDs of hidden posts
        hidden_posts = HiddenPost.objects.filter(user=user).values_list('post', flat=True)

        # Exclude posts from blocked users and hidden posts
        return Post.objects.filter(status='active').exclude(author__in=blocked_users).exclude(id__in=hidden_posts)

# Used for Chains 
class ChainViewSet(viewsets.ModelViewSet):
    queryset = Chain.objects.all()
    serializer_class = ChainSerializer
    permission_classes = [permissions.IsAuthenticated]

# Used for Messages View
class MessageViewSet(viewsets.ModelViewSet):
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    # Used for Upvoting a Message
    @action(detail=True, methods=['post'])
    def upvote(self, request, pk=None):
        """Handles upvoting a message."""
        message = self.get_object()
        user = request.user
        # print(f"User {user.id} ({user.username}) is attempting to upvote Message {message.id}")

        try:
            # Log the current state of the vote
            # print(f"Checking if user {user.id} has already voted on Message {message.id}")

            # Check if user has already voted
            vote, created = MessageVote.objects.get_or_create(
                user=user, message=message, defaults={'vote_type': 'up', 'value': 1}
            )

            if not created:  # User has already voted
                # print(f"Vote exists: User {user.id} already voted {vote.vote_type} on Message {message.id}")
                if vote.vote_type == 'up':
                    # print(f"User {user.id} already upvoted Message {message.id}")
                    return Response({'message': 'Already upvoted'}, status=status.HTTP_400_BAD_REQUEST)
                # Change vote from downvote to upvote
                # print(f"Changing vote from downvote to upvote for User {user.id} on Message {message.id}")
                vote.vote_type = 'up'
                vote.value = 1
                vote.save()

                # print(f"User {user.id} changed vote to upvote on Message {message.id}")

            # Recalculate vote count
            message.update_vote_count()
            # print(f"Message {message.id} new vote count: {message.vote_count}")
            return Response({'message': 'Upvoted successfully', 'vote_count': message.vote_count}, status=status.HTTP_200_OK)

        except Exception as e:
            # print(f"Error upvoting Message {message.id}: {str(e)}", exc_info=True)
            return Response({'message': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Used for Downvoting a Message
    @action(detail=True, methods=['post'])
    def downvote(self, request, pk=None):
        """Handles downvoting a message."""
        message = self.get_object()
        user = request.user

        # Check if user has already voted
        vote, created = MessageVote.objects.get_or_create(user=user, message=message, defaults={'vote_type': 'down', 'value': -1})

        if not created:  # User has already voted
            if vote.vote_type == 'down':
                return Response({'message': 'Already downvoted'}, status=status.HTTP_400_BAD_REQUEST)
            # Change vote from upvote to downvote
            vote.vote_type = 'down'
            vote.value = -1
            vote.save()

        # Recalculate vote count
        message.update_vote_count()
        return Response({'message': 'Downvoted successfully', 'vote_count': message.vote_count}, status=status.HTTP_200_OK)

    # Hide a Message
    @action(detail=True, methods=['post'])
    def hide(self, request, pk=None):
        """Allows a user to hide a message"""
        message = self.get_object()
        HiddenMessage.objects.get_or_create(user=request.user, message=message)
        return Response({'message': 'Message hidden successfully'}, status=status.HTTP_200_OK)
    
    # Unhide a Message
    @action(detail=True, methods=['post'])
    def unhide(self, request, pk=None):
        """Allows a user to unhide a message"""
        message = self.get_object()
        HiddenMessage.objects.filter(user=request.user, message=message).delete()
        return Response({'message': 'Message unhidden successfully'}, status=status.HTTP_200_OK)

    # Exclude messages from blocked users
    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Message.objects.exclude(hidden_by_users__user=user)

        # Get IDs of blocked users
        blocked_users = UserBlock.objects.filter(blocker=user).values_list('blocked', flat=True)

        # Exclude messages from blocked users
        return Message.objects.exclude(author__in=blocked_users)
    
# Edit Message View 
class EditMessageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, message_id):
        # print(f"Received PATCH request for message_id: {message_id}")

        # Check if the user is authenticated
        if not request.user.is_authenticated:
            # print("User is not authenticated.")
            return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)
        
        message = get_object_or_404(Message, pk=message_id)

        # Ensure only the author can edit
        if message.author != request.user:
            # print(f"User {request.user} is not the author of the message.")
            return Response({"error": "You can only edit your own messages."}, status=status.HTTP_403_FORBIDDEN)

        message.content = request.data.get("content", message.content)
        message.save()
        # print(f"Message {message_id} edited successfully.")
        return Response(MessageSerializer(message, context={"request": request}).data)

# Delete message view 
class DeleteMessageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, message_id):
        # print(f"[DeleteMessageView] Received DELETE request for message ID: {message_id}")
        # print(f"[DeleteMessageView] Request user: {request.user} (ID: {request.user.id})")

        try:
            message = get_object_or_404(Message, pk=message_id)
            # print(f"[DeleteMessageView] Found message. Author: {message.author} (ID: {message.author.id})")
        except Exception as e:
            # print(f"[DeleteMessageView] Error retrieving message ID {message_id}: {e}")
            return Response({"error": "Message not found."}, status=status.HTTP_404_NOT_FOUND)

        if message.author != request.user:
            # print(f"[DeleteMessageView] Permission denied. User {request.user.id} is not the author.")
            return Response({"error": "You can only delete your own messages."}, status=status.HTTP_403_FORBIDDEN)

        try:
            message.delete()
            # print(f"[DeleteMessageView] Message ID {message_id} deleted successfully.")
            # return Response({"message": "Message deleted successfully"}, status=status.HTTP_204_NO_CONTENT)
            # Removed delete status message because it was causing problems with the fetch
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            # print(f"[DeleteMessageView] Error deleting message ID {message_id}: {e}")
            return Response({"error": "Failed to delete message."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
 
# Post Messages View 
# Returns Messages Grouped by Chain
class PostMessagesView(APIView):
    """Retrieve messages grouped by chains for a specific post."""
    permission_classes = [AllowAny]

    def get(self, request, post_slug):
        post = get_object_or_404(Post, slug=post_slug)
        
        # ✅ Prefetch messages with authors and their profiles in one query
        chains = Chain.objects.filter(post=post).prefetch_related(
            Prefetch("messages", queryset=Message.objects.select_related("author").prefetch_related("author__profile"))
        )

        response_data = []
        for chain in chains:
            messages = chain.messages.order_by("created_at")
            response_data.append({
                "chain_id": chain.id,
                "messages": MessageSerializer(messages, many=True, context={'request': request}).data
            })

        return Response(response_data)
    
# Create Message View 
# This view handles replies to messages and should ensure that the message is added to the same chain as the parent message.
class CreateMessageView(generics.CreateAPIView):
    """Handles replies to messages within the same chain."""
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        post_slug = self.kwargs['post_slug']
        post = get_object_or_404(Post, slug=post_slug)

        parent_message = serializer.validated_data.get('parent_message', None)

        if parent_message:
            # Reply stays in the same chain
            chain = parent_message.chain
        else:
            return Response({"detail": "Replies must have a parent message."}, status=400)

        serializer.save(author=self.request.user, chain=chain)

# Gathers last 20 messages
class RecentMessagesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    # print("Made it to recent messages.")

    def get(self, request, *args, **kwargs):
        """
        Get recent messages from posts in communities the user follows.
        """
        user = request.user
        followed_communities = CommunityFollow.objects.filter(user=user).values_list('community', flat=True)

        recent_messages = Message.objects.filter(
            chain__post__community_id__in=followed_communities
        ).select_related('chain__post', 'author').order_by('-created_at')[:20]  # Adjust limit if needed

        # print("Recent messages:", recent_messages)
        # Pass the context (which contains the request) to the serializer
        serializer = MessageSerializerHome(recent_messages, many=True, context={"request": request})
        return Response(serializer.data)
    
# OpenGraph View
class OpenGraphView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, *args, **kwargs):
        # Get the URL from the request query parameters
        url = request.query_params.get('url', None)
        
        if not url:
            return JsonResponse({"error": "URL parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Make a request to the provided URL to fetch the content
            response = requests.get(url)
            response.raise_for_status()  # Raise an error for bad HTTP status codes

            # Parse the content with BeautifulSoup
            soup = BeautifulSoup(response.content, 'html.parser')

            # Find OpenGraph metadata in the HTML
            og_data = {
                "title": soup.find("meta", property="og:title")["content"] if soup.find("meta", property="og:title") else None,
                "description": soup.find("meta", property="og:description")["content"] if soup.find("meta", property="og:description") else None,
                "image": soup.find("meta", property="og:image")["content"] if soup.find("meta", property="og:image") else None,
                "url": soup.find("meta", property="og:url")["content"] if soup.find("meta", property="og:url") else None,
            }

            # Return the OpenGraph data as JSON response
            return JsonResponse(og_data, status=status.HTTP_200_OK)

        except requests.exceptions.RequestException as e:
            # If there's an error fetching the URL or parsing it, return an error response
            return JsonResponse({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)    

class HidePostView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        user = request.user
        # print(f"🔍 User: {user}, Slug: {slug}")

        # Attempt to fetch the post
        post = get_object_or_404(Post, slug=slug)
        # print(f"✅ Post Found: {post.title}")

        # Check if the post is already hidden
        if HiddenPost.objects.filter(user=user, post=post).exists():
            # print(f"⚠️ Post already hidden by {user}")
            return Response({"detail": "You have already hidden this post"}, status=status.HTTP_400_BAD_REQUEST)

        # Hide the post safely
        try:
            with transaction.atomic():
                HiddenPost.objects.create(user=user, post=post)
                post.hidden_by_users_count += 1  # Increment the count of users who have hidden the post
                post.save()
                # print(f"✅ Post {post.title} hidden by {user}. Hidden count: {post.hidden_by_users_count}")
            
            return Response({"detail": "Post hidden successfully"}, status=status.HTTP_201_CREATED)

        except IntegrityError as e:
            # print(f"🚨 IntegrityError: {e}")
            return Response({"error": "Database error while hiding post"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        except Exception as e:
            # print(f"🚨 Unexpected Error: {e}")
            return Response({"error": "Something went wrong"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ShowPostView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        user = request.user
        # print(f"🔍 User: {user}, Slug: {slug}")

        # Attempt to fetch the post
        post = get_object_or_404(Post, slug=slug)
        # print(f"✅ Post Found: {post.title}")

        # Check if the post is hidden by the user
        hidden_post = HiddenPost.objects.filter(user=user, post=post).first()
        if not hidden_post:
            # print(f"❌ Post is not hidden by {user}")
            return Response({"detail": "Post is not hidden by you"}, status=status.HTTP_400_BAD_REQUEST)

        # Hide the post
        with transaction.atomic():
            hidden_post.delete()
            post.hidden_by_users_count -= 1  # Decrease the count of users who have hidden the post
            post.save()
            # f"✅ Post {post.title} shown by {user}. Hidden count: {post.hidden_by_users_count}")

        return Response({"detail": "Post shown successfully"}, status=status.HTTP_200_OK)

# Allows us to track which posts are hidden by which users
class UserHiddenPosts(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Return a list of post slugs that the user has hidden."""
        # print(f"🔍 Request received from user: {request.user.username}")

        hidden_posts = HiddenPost.objects.filter(user=request.user).select_related('post')
        # print(f"✅ Found {hidden_posts.count()} hidden posts for user: {request.user.username}")

        # Check if any hidden posts exist
        # if not hidden_posts.exists():
        #     print("🚨 No hidden posts found!")

        # Extract slugs
        hidden_post_slugs = [hidden_post.post.slug for hidden_post in hidden_posts]
        # print(f"📝 Hidden post slugs: {hidden_post_slugs}")

        return Response(hidden_post_slugs)

# Fetches blocked users 
class BlockedUsersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Get all blocked users where the current user is the blocker
        blocked_users = UserBlock.objects.filter(blocker=request.user)

        # Create a list of usernames for the blocked users
        blocked_usernames = [user_block.blocked.username for user_block in blocked_users]

        # Return the list of blocked usernames
        return Response(blocked_usernames, status=200)

# block a new user
class BlockNewUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, username):
        try:
            # Get the user to be blocked
            user_to_block = User.objects.get(username=username)

            # Ensure the user is not trying to block themselves
            if user_to_block == request.user:
                return Response({"error": "You cannot block yourself."}, status=400)

            # Create a new UserBlock entry
            UserBlock.objects.create(blocker=request.user, blocked=user_to_block)

            return Response({"message": "User blocked successfully!"}, status=200)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)
        
# unblock a user 
class UnblockUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, username):
        try:
            # Find the user that the logged-in user has blocked
            blocked_user = UserBlock.objects.get(blocker=request.user, blocked__username=username)

            # Delete the block relationship (unblock)
            blocked_user.delete()

            return Response({"message": f"User {username} has been unblocked."}, status=200)
        except UserBlock.DoesNotExist:
            return Response({"error": "The user is not blocked."}, status=400)

# Report a Post View 
class PostReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug):
        post = get_object_or_404(Post, slug=slug)

        # Set the reporters details 
        report_url = f"https://axionnode.com/post/{slug}"  # Direct link to the reported post
        reporter_username = request.user.username  # Get the username of the reporter
        admin_hide_url = f"https://axionnode.com/api/post-report-hide-X12345599s/{post.slug}/"
        admin_unhide_url = f"https://axionnode.com/api/unblock-post-123445dds/{post.slug}/"

        # Check if the user has already reported this post
        if PostReport.objects.filter(post=post, reported_by=request.user).exists():
            return Response({"message": "You have already reported this post."}, status=status.HTTP_400_BAD_REQUEST)

        # Create a report
        PostReport.objects.create(post=post, reported_by=request.user)

        # Email the admins
        message = Mail(
            from_email=settings.SENDGRID_FROM_EMAIL,
            to_emails=['support@axionnode.com'],
            subject='⚠️ Reported/flagged post alert',
            html_content=f'The following user: {reporter_username} has reported the post titled: {post.title} that you can view at this link: {report_url}. If you would like to set this post as banned, then click this link: {admin_hide_url}. If you would like to unban this post if you have already banned it, then click here: {admin_unhide_url}'
        )
        try:
            sg = SendGridAPIClient(settings.SENDGRID_API_KEY) 
            response = sg.send(message)
            # print(f"Email sent successfully: {response.status_code}")  # Debugging
        except Exception as e:
            print(f"Error sending email: {e}")

        return Response({"message": "Post has been reported successfully."}, status=status.HTTP_201_CREATED)
    
# Admin activity to hide a post
class PostReportHideView(APIView):
    permission_classes = [AllowAny]  # ✅ Allow anyone with the link

    def get(self, request, slug):

        # print("Made it to the post report hide view")

        post = get_object_or_404(Post, slug=slug)

        # ✅ Mark the post as banned
        post.status = 'banned'
        post.save(update_fields=['status'])

        return Response({"message": f"Post '{post.title}' has been banned."}, status=status.HTTP_200_OK)
    
# Admin activity to unhide a post
class PostReportUnHideView(APIView):
    permission_classes = [AllowAny]  # ✅ Allow anyone with the link

    def get(self, request, slug):

        # print("Made it to the post report hide view")

        post = get_object_or_404(Post, slug=slug)

        # ✅ Mark the post as active
        post.status = 'active'
        post.save(update_fields=['status'])

        return Response({"message": f"Post '{post.title}' has been Unbanned."}, status=status.HTTP_200_OK)
    
# Delete account view
# class DeleteAccountView(APIView):
#     permission_classes = [permissions.IsAuthenticated]
    
#     def delete(self, request, *args, **kwargs):
#         user = request.user
        
#         # Delete user's posts
#         Post.objects.filter(author=user).delete()
        
#         # Delete user's messages
#         Message.objects.filter(author=user).delete()
        
#         # Delete user's profile photo (if exists)
#         user_profile = UserProfile.objects.filter(user=user).first()
#         if user_profile and user_profile.profile_photo:
#             user_profile.profile_photo.delete(save=False)  # Delete file from storage
        
#         # Delete user profile
#         UserProfile.objects.filter(user=user).delete()
        
#         # Delete the user account
#         user.delete()
        
#         return JsonResponse({"message": "Your account has been deleted successfully."}, status=200)