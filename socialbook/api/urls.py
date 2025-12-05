from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PublicPostListView, Disable2FAView, ValidateTokenView, EnableTOTPDeviceView, TwoFactorStatusView, GenerateTOTPDeviceView, ConfirmTOTPDeviceView, CustomLoginView, VerifyOTPView, DeleteAccountView, PostReportUnHideView, PostReportHideView, PostReportView, UnblockUserView, BlockNewUserView, BlockedUsersView, UserHiddenPosts, ShowPostView, HidePostView, CustomTokenRefreshView, OpenGraphView, PostsRemoveVote, MessagesRemoveVote, RecentMessagesView, EditMessageView, DeleteMessageView, CommunityApprovalView, CommunityApprovalRequestView, PasswordResetView, PasswordResetRequestView, RespondToChainView, RespondToPostView, DownvotePostView, UpvotePostView, CreateMessageView, PostMessagesView, PostEditView, PostDeleteView, PostDetailView, UserProfileByUsernameView, CommunityListPostView, UnfollowCommunityView, FollowCommunityView, FollowStatusView, HomePostListView, CommunityDetailView, CommunityListCreateView, PostViewSet, ChainViewSet, MessageViewSet, LogoutView, UserProfileView, ChangePasswordView, RegisterView, UserProfilePhotoUpdateView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView

router = DefaultRouter()
# router.register(r'communities', CommunityListCreateView)
router.register(r'posts', PostViewSet)
router.register(r'chains', ChainViewSet)
router.register(r'messages', MessageViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('auth/me/', UserProfileView.as_view(), name='user-profile'),
    path('auth/me/password-change/', ChangePasswordView.as_view(), name='password-change'), 
    path("register/", RegisterView.as_view(), name="register"),
    path('auth/me/photo/', UserProfilePhotoUpdateView.as_view(), name='user-profile-photo-update'),
    path('communities/', CommunityListCreateView.as_view(), name='community-list-create'),
    path('communities-post/', CommunityListPostView.as_view(), name='community-list-post'),
    path('communities/<slug:slug>/', CommunityDetailView.as_view(), name='community-detail'),
    path("communities/<slug:slug>/follow/", FollowCommunityView.as_view(), name="follow-community"),
    path("communities/<slug:slug>/unfollow/", UnfollowCommunityView.as_view(), name="unfollow-community"),
    path("communities/<slug:slug>/follow-status/", FollowStatusView.as_view(), name="follow-status"),
    path('approve-community-request/', CommunityApprovalRequestView.as_view(), name='approve-community-request'),
    path('approve-community/<slug:slug>/<str:token>/', CommunityApprovalView.as_view(), name='approve-community'),
    # path('posts/', PostCreateView.as_view(), name='create-post'),
    path('home/', HomePostListView.as_view(), name='home-post-list'),
    path('public-posts/', PublicPostListView.as_view(), name='public-post-list'),
    path('post/<slug:slug>/', PostDetailView.as_view(), name='post-detail'),
    path('post/<slug:slug>/upvote/', UpvotePostView.as_view(), name='post-upvote'),
    path('post/<slug:slug>/downvote/', DownvotePostView.as_view(), name='post-downvote'),
    path('post/<slug:slug>/hide/', HidePostView.as_view(), name='post-hide'),
    path('post/<slug:slug>/show/', ShowPostView.as_view(), name='post-show'),
    path('user-hidden-posts/', UserHiddenPosts.as_view(), name='user-hidden-posts'),
    path('user-blocked-users/', BlockedUsersView.as_view(), name='user-blocked-users'),
    path('blocked-new-user/<str:username>/', BlockNewUserView.as_view(), name='block-new-user'),
    path('unblock-user/<str:username>/', UnblockUserView.as_view(), name='unblock-user'),
    path('post/<slug:slug>/respond/', RespondToPostView.as_view(), name='respond-to-post'),
    path('post/<slug:slug>/chain/<int:chain_id>/respond/', RespondToChainView.as_view(), name='respond_to_chain'),
    path('post/<slug:post_slug>/messages/', PostMessagesView.as_view(), name='post-messages'),
    path('post/<slug:post_slug>/messages/create/', CreateMessageView.as_view(), name='create-message'),
    path('post-delete/<slug:slug>/', PostDeleteView.as_view(), name='post-delete'),
    path('post-edit/<slug:slug>/', PostEditView.as_view(), name='post-edit'),
    path('user/<str:username>/', UserProfileByUsernameView.as_view(), name='user-profile'),
    path('password-reset-request/', PasswordResetRequestView.as_view(), name='password-reset-request'),
    path('password-reset/', PasswordResetView.as_view(), name='password-reset'),
    path('message-edit/<int:message_id>/', EditMessageView.as_view(), name='edit-message'),
    path('messages-remove-vote/<int:message_id>/', MessagesRemoveVote.as_view(), name='remove-message-vote'),
    path('post-remove-vote/<int:post_id>/', PostsRemoveVote.as_view(), name='remove-post-vote'),
    path('message-delete/<int:message_id>/', DeleteMessageView.as_view(), name='delete-message'),
    path('recent-messages/', RecentMessagesView.as_view(), name='recent-messages'),
    path('opengraph/', OpenGraphView.as_view(), name='opengraph'),
    path('post-report/<slug:slug>/', PostReportView.as_view(), name='post-report'),
    path('post-report-hide-X12345599s/<slug:slug>/', PostReportHideView.as_view(), name='post-report-hide'),
    path('unblock-post-123445dds/<slug:slug>/', PostReportUnHideView.as_view(), name='post-report-unhide'),
    # path('delete-account/me/', DeleteAccountView.as_view(), name='delete-account'),
    path('auth/validate-token/', ValidateTokenView.as_view(), name='validate-token'),
    path('delete-account/', DeleteAccountView.as_view(), name='delete-account'),

    # TOTP Device Generation and Confirmation
    path('auth/generate-totp/', GenerateTOTPDeviceView.as_view(), name='generate-totp-device'),
    # path('auth/confirm-totp/', ConfirmTOTPDeviceView.as_view(), name='confirm-totp-device'),
    path('auth/confirm-2fa/', ConfirmTOTPDeviceView.as_view(), name='confirm-2fa'),
    path('auth/2fa-status/', TwoFactorStatusView.as_view(), name='2fa-status'),
    path('auth/enable-2fa/', EnableTOTPDeviceView.as_view(), name='enable-2fa'),

    # Custom Login and OTP Verification
    path('auth-login/', CustomLoginView.as_view(), name='custom-login'),
    path('auth/verify-otp/', VerifyOTPView.as_view(), name='verify-otp'),

    # Disable 2fa
    path('auth/disable-2fa/', Disable2FAView.as_view(), name='disable-2fa'),
]