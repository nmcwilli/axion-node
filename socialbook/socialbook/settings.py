# Revisions and modifications to licensed content Copyright 2025 Clockwork Venture Inc. 
# Release: AxionNode Backend (AKA SocialBook)
# Description: An open-source social platform 
# Author: Michael Neil McWilliam

import io
import os
from urllib.parse import urlparse
from datetime import timedelta

import environ
import google.auth
from google.cloud import secretmanager

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# BASE_DIR = os.path.dirname(os.path.dirname(__file__))

# [START cloudrun_django_secret_config]
# SECURITY WARNING: don't run with debug turned on in production!
# Change this to "False" when you are Ready for production
env = environ.Env(DEBUG=(bool, False))
env_file = os.path.join(BASE_DIR, ".env")

# Attempt to load the Project ID into the environment, safely failing on error.
# try:
#     _, os.environ["GOOGLE_CLOUD_PROJECT"] = google.auth.default()
# except google.auth.exceptions.DefaultCredentialsError:
#     pass
try:
    creds, project = google.auth.default()
    os.environ["GOOGLE_CLOUD_PROJECT"] = project
except google.auth.exceptions.DefaultCredentialsError:
    os.environ["GOOGLE_CLOUD_PROJECT"] = "your-project-id"

# Pull secrets from Secret Manager
project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
client = secretmanager.SecretManagerServiceClient()
settings_name = os.environ.get("SETTINGS_NAME", "django_settings_socialbook")
name = f"projects/{project_id}/secrets/{settings_name}/versions/latest"
payload = client.access_secret_version(name=name).payload.data.decode("UTF-8")
env.read_env(io.StringIO(payload))

# OpenAI Key
OPENAI_API_KEY = env("OPENAI_API_KEY")

# [END cloudrun_django_secret_config]
SECRET_KEY = env("SECRET_KEY")

DEBUG = env("DEBUG")

# [START cloudrun_django_csrf]
# SECURITY WARNING: It's recommended that you use this when
# running in production. The URL will be known once you first deploy
# to Cloud Run. This code takes the URL and converts it to both these settings formats.
CLOUDRUN_SERVICE_URL = env("CLOUDRUN_SERVICE_URL", default=None)
if CLOUDRUN_SERVICE_URL:
    ALLOWED_HOSTS = [urlparse(CLOUDRUN_SERVICE_URL).netloc, 'axionnode.com', '*', '127.0.0.1', 'localhost:8081', '0.0.0.0:8000']
    CSRF_TRUSTED_ORIGINS = [CLOUDRUN_SERVICE_URL, "http://localhost:8081", "http://0.0.0.0:8000"]
    CSRF_COOKIE_SECURE = True
    CSRF_COOKIE_SAMESITE = None
    SECURE_SSL_REDIRECT = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
else:
    ALLOWED_HOSTS = ["*"]
    CSRF_COOKIE_SECURE = False
    CSRF_COOKIE_SAMESITE = None
# [END cloudrun_django_csrf]

# Application definition
INSTALLED_APPS = [
    "corsheaders", 
    "django_extensions", 
    "jazzmin",
    "api.apps.ApiConfig",
    "core.apps.CoreConfig",
    "socialbook",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "storages",
    "import_export",
    "phonenumber_field",
    "widget_tweaks",
    "rest_framework", 
    "rest_framework_simplejwt", # Added for JWT authentication
    "rest_framework_simplejwt.token_blacklist",  # Optional, for token blacklisting
    "django_filters", 
    # "django_celery_beat", 
    # "django_celery_results", 
    'django_otp',
    'django_otp.plugins.otp_totp',
    # 'django_otp.plugins.otp_hotp',
    # 'django_otp.plugins.otp_static',
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django_otp.middleware.OTPMiddleware", 
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "corsheaders.middleware.CorsMiddleware"
]

ROOT_URLCONF = "socialbook.urls"

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'templates')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]   
WSGI_APPLICATION = "socialbook.wsgi.application"

# Database
# [START cloudrun_django_database_config]
# Use django-environ to parse the connection string
DATABASES = {"default": env.db()}

# If the flag as been set, configure to use proxy
# If we are testing locally, we must be running the Cloud SQL Proxy if you 
# are connecting to a Database in Cloud SQL (in our case we are)! 
if os.getenv("USE_CLOUD_SQL_AUTH_PROXY", None):
    DATABASES["default"]["HOST"] = "127.0.0.1"
    DATABASES["default"]["PORT"] = 5432

# [END cloudrun_django_database_config]

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "America/Halifax"
USE_I18N = True
USE_L10N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
# [START cloudrun_django_static_config]
# Define static storage via django-storages[google]
# In our example, we are using a Google Bucket to store our static files for the project. 
GS_BUCKET_NAME = env("GS_BUCKET_NAME")
# Private bucket settings for TalentMatchAI.com Tenant
# GS_BUCKET_NAME_PRIVATE = env("GS_BUCKET_NAME_PRIVATE")

# Allow larger file uploads
# DATA_UPLOAD_MAX_MEMORY_SIZE = 1024 * 1024 * 10  # Set to 10 MB (default is 2.5 MB)
# FILE_UPLOAD_MAX_MEMORY_SIZE = 1024 * 1024 * 10  # 10 MB for file uploads

DATA_UPLOAD_MAX_MEMORY_SIZE = 5242880

STATIC_URL = "/static/"
# MEDIA_URL = '/media/'
# MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
# these have now been deprecated
# -- deprecated - DEFAULT_FILE_STORAGE = "storages.backends.gcloud.GoogleCloudStorage"
# -- deprecated - STATICFILES_STORAGE = "storages.backends.gcloud.GoogleCloudStorage"
STORAGES = {
    "default": {
        "BACKEND": "storages.backends.gcloud.GoogleCloudStorage",
    },
    "staticfiles": {
        "BACKEND": "storages.backends.gcloud.GoogleCloudStorage",
    },
}
GS_DEFAULT_ACL = "publicRead"
# [END cloudrun_django_static_config]

# Default primary key field type
# https://docs.djangoproject.com/en/3.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Sendgrid settings
# For emailing out of the platform, here we are setting a default contact email
# admin email, newsletter from email, and then routing all smtp traffic through SendGrid
# You can easily adjust this and use a different provider as required 
CONTACT_EMAIL = 'support@axionnode.com' 
ADMIN_EMAIL = ['support@axionnode.com'] 
SENDGRID_FROM_EMAIL = 'support@axionnode.com' 
SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY') 
EMAIL_HOST = 'smtp.sendgrid.net' 
EMAIL_PORT = 587 
EMAIL_USE_TLS = True 
EMAIL_HOST_USER = 'apikey' 
EMAIL_HOST_PASSWORD = os.environ.get('SENDGRID_API_KEY')

# phonenumber_field settings
# Phone number DB format
# Set the typical phone number settings you would like your app to use
PHONENUMBER_DB_FORMAT = 'NATIONAL' 
PHONENUMBER_DEFAULT_REGION = 'US' 

# django import/export settings
IMPORT_EXPORT_USE_TRANSACTIONS = True 

# google reCaptcha
# Store your reCaptcha Public and Private keys in your environment variables 
# Ideally in a centralized/protected spot - i.e. Google Secrets or AWS Secrets 
# RECAPTCHA_PUBLIC_KEY = os.environ.get('RECAPTCHA_PUBLIC_KEY')
# RECAPTCHA_PRIVATE_KEY = os.environ.get('RECAPTCHA_PRIVATE_KEY')
# SILENCED_SYSTEM_CHECKS = ['captcha.recaptcha_test_key_error']

# REST Framework
# Sets throttling for Anonymous and Authenticated Users 
# Currently the API only allows authenticated users
# Note that you can enforce JSON Web Tokens as authentication and NOT Basic Authentication
# by adding 'DEFAULT_AUTHENTICATION_CLASSES': ('knox.auth.TokenAuthentication',), to the 
# REST_FRAMEWORK section below: 
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '500/day',
        'user': '5000/day'
    },
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'DEFAULT_TEMPLATE_CLASS': 'rest_framework/my_base.html', 
    'PAGE_SIZE': 1000,
    # 'DEFAULT_AUTHENTICATION_CLASSES': [
    #     'api.authentication.CustomTenantJWTAuthentication',
    # ],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

# URL and routing configurations
# APPEND_SLASH = False  # Disable automatic appending of slashes to URLs

# SIMPLE JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=4),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=60),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,  # Use your Django secret key or another secure key
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# Authentication backends
AUTHENTICATION_BACKENDS = [
    'core.backends.EmailOrUsernameModelBackend',  # Allows Email and Password authentication
    'django.contrib.auth.backends.ModelBackend',  # Default Django auth backend
]

# Allow only specific origins
CORS_ALLOWED_ORIGINS = [
    "https://axionnode.com",
    "http://localhost:8081", 
    "http://localhost:8000", 
    "http://0.0.0.0:8000", 
    "http://127.0.0.1", 
    "http://127.0.0.1:8000",
    "http://127.0.0.1:8080",
    "http://localhost:8080"
]

# CORS_ALLOW_CREDENTIALS = True

# Do not allow all origins
CORS_ALLOW_ALL_ORIGINS = False

# CSRF Override Settings 
CSRF_COOKIE_SAMESITE = False # Cookie doesn't have to originate from the same site 
CSRF_COOKIE_SECURE = False  # Set this to True if serving over HTTPS daja

# CRON for News Article Scraping
CRON_CLASSES = [
    'core.cron.ScrapeCronJob',
]

# CLOUD FUNCTIONS SETTINGS
CLOUD_FUNCTION_SECRET_KEY = os.environ.get('CLOUD_FUNCTION_SECRET_KEY')

# JAZZMIN Settings for UI Design
JAZZMIN_SETTINGS = {
    # title of the window (Will default to current_admin_site.site_title if absent or None)
    "site_title": "AxionNode",

    # Title on the login screen (19 chars max) (defaults to current_admin_site.site_header if absent or None)
    "site_header": "AxionNode",

    # Title on the brand (19 chars max) (defaults to current_admin_site.site_header if absent or None)
    "site_brand": "AxionNode",

    # Logo to use for your site, must be present in static files, used for brand on top left
    # "site_logo": "TalentMatchAI_Logo_2.png",

    # Logo to use for your site, must be present in static files, used for login form logo (defaults to site_logo)
    "login_logo": None,

    # Logo to use for login form in dark themes (defaults to login_logo)
    "login_logo_dark": None,

    # CSS classes that are applied to the logo above
    "site_logo_classes": "img-circle",

    # Relative path to a favicon for your site, will default to site_logo if absent (ideally 32x32 px)
    "site_icon": None,

    # Welcome text on the login screen
    "welcome_sign": "Welcome to AxionNode - An open-source social platform",

    # Copyright on the footer
    "copyright": "Clockwork Venture Inc.",

    # List of model admins to search from the search bar, search bar omitted if excluded
    # If you want to use a single search field you dont need to use a list, you can use a simple string 
    "search_model": [],
    # "search_model": ["auth.User", "auth.Group"],

    # Field name on user model that contains avatar ImageField/URLField/Charfield or a callable that receives the user
    "user_avatar": None,

    ############
    # Top Menu #
    ############

    # Links to put along the top menu
    "topmenu_links": [

        # Url that gets reversed (Permissions can be added)
        # {"name": "Home",  "url": "admin:index", "permissions": ["auth.view_user"]},

        # model admin to link to (Permissions checked against model)
        # {"model": "auth.User"},

        # App with dropdown menu to all its models pages (Permissions checked against models)
        # {"app": "candidates"},

        # external urls that opens in a new window (Permissions can be added)
        # {"name": "API", "url": "/api/", "new_window": True},
        # {"name": "Support", "url": "https://talentmatchai.com/contact/", "new_window": True},
    ],

    #############
    # User Menu #
    #############

    # Additional links to include in the user menu on the top right ("app" url type is not allowed)
    "usermenu_links": [
        # {"name": "Support", "url": "https://talentmatchai.com/contact/", "new_window": True},
        {"model": "auth.user"}
    ],

    #############
    # Side Menu #
    #############

    # Whether to display the side menu
    "show_sidebar": True,

    # Whether to aut expand the menu
    "navigation_expanded": True,

    # Hide these apps when generating side menu e.g (auth)
    "hide_apps": [],

    # Hide these models when generating side menu (e.g auth.user)
    "hide_models": [],

    # List of apps (and/or models) to base side menu ordering off of (does not need to contain all apps/models)
    "order_with_respect_to": ["auth", "core"],

    # Custom links to append to app groups, keyed on app name
    # "custom_links": {
    #     "candidates": [
    #         {
    #             "name": "AI Search",
    #             "url": "/candidates/search/",  # URL to AI Search view
    #             "icon": "fas fa-search",
    #         }, 
    #         {
    #             "name": "Bulk Import",
    #             "url": "/candidates/bulk/",  # URL to Bulk importer view
    #             "icon": "fas fa-solid fa-file-import",
    #         }
    #     ]
    # }, 

    # Custom icons for side menu apps/models See https://fontawesome.com/icons?d=gallery&m=free&v=5.0.0,5.0.1,5.0.10,5.0.11,5.0.12,5.0.13,5.0.2,5.0.3,5.0.4,5.0.5,5.0.6,5.0.7,5.0.8,5.0.9,5.1.0,5.1.1,5.2.0,5.3.0,5.3.1,5.4.0,5.4.1,5.4.2,5.13.0,5.12.0,5.11.2,5.11.1,5.10.0,5.9.0,5.8.2,5.8.1,5.7.2,5.7.1,5.7.0,5.6.3,5.5.0,5.4.2
    # for the full list of 5.13.0 free icon classes
    "icons": {
        "auth": "fas fa-users-cog",
        "auth.user": "fas fa-user",
        "auth.Group": "fas fa-users",
        "candidates.jobdescriptions": "fas fa-briefcase", 
        "candidates.candidate": "fas fa-person", 
        "web.aboutus": "fas fa-address-card", 
        "web.background_image": "fas fa-image", 
        "web.company_logo": "fas fa-image", 
        "web.company_phone": "fas fa-phone", 
        "web.contact": "fas fa-envelope", 
        "web.core_feature1_image": "fas fa-image", 
        "web.core_feature2_image": "fas fa-image", 
        "web.core_feature3_image": "fas fa-image", 
        "web.core_feature4_image": "fas fa-image", 
        "web.core_feature5_image": "fas fa-image", 
        "web.core_feature6_image": "fas fa-image", 
        "web.media": "fas fa-image", 
        "web.core_feature1_cta": "fas fa-heading", 
        "web.core_feature2_cta": "fas fa-heading", 
        "web.core_feature3_cta": "fas fa-heading", 
        "web.core_feature4_cta": "fas fa-heading", 
        "web.core_feature5_cta": "fas fa-heading", 
        "web.core_feature6_cta": "fas fa-heading", 
        "web.core_feature1_headline_p": "fas fa-paragraph", 
        "web.core_feature2_headline_p": "fas fa-paragraph", 
        "web.core_feature3_headline_p": "fas fa-paragraph", 
        "web.core_feature4_headline_p": "fas fa-paragraph", 
        "web.core_feature5_headline_p": "fas fa-paragraph", 
        "web.core_feature6_headline_p": "fas fa-paragraph", 
        "web.core_features_headline": "fas fa-heading", 
        "web.design": "fas fa-pen-nib", 
        "web.favicon": "fas fa-globe", 
        "web.featured_headline_cta": "fas fa-stop", 
        "web.featured_headline": "fas fa-heading",
        "web.featured_image": "fas fa-image",
        "web.featured_headline_p": "fas fa-paragraph",
        "web.googleanalytics": "fa fa-chart-pie",
        "web.meta_author": "fas fa-feather",
        "web.meta_description": "fas fa-font",
        "web.company_name": "fas fa-font",
        "web.footer": "fas fa-font",
        "web.modules": "fa fa-puzzle-piece",
        "web.nav": "fa fa-bars",
        "web.page_title": "fas fa-heading",
        "web.privacy": "fas fa-font",
        "web.terms": "fas fa-font",
    },
    # Icons that are used when one is not manually specified
    "default_icon_parents": "fas fa-chevron-circle-right",
    "default_icon_children": "fas fa-circle",

    #################
    # Related Modal #
    #################
    # Use modals instead of popups
    "related_modal_active": False,

    #############
    # UI Tweaks #
    #############
    # Relative paths to custom CSS/JS scripts (must be present in static files)
    "custom_css": None,
    "custom_js": None,
    # Whether to link font from fonts.googleapis.com (use custom_css to supply font otherwise)
    "use_google_fonts_cdn": True,
    # Whether to show the UI customizer on the sidebar
    "show_ui_builder": False,

    ###############
    # Change view #
    ###############
    # Render out the change view as a single form, or in tabs, current options are
    # - single
    # - horizontal_tabs (default)
    # - vertical_tabs
    # - collapsible
    # - carousel
    "changeform_format": "horizontal_tabs",
    # override change forms on a per modeladmin basis
    "changeform_format_overrides": {"auth.user": "collapsible", "auth.group": "vertical_tabs"},
    # Add a language dropdown into the admin
    "language_chooser": False,
}
JAZZMIN_UI_TWEAKS = {
    "navbar_small_text": False,
    "footer_small_text": False,
    "body_small_text": True,
    "brand_small_text": False,
    "brand_colour": "navbar-dark",
    "accent": "accent-navy",
    "navbar": "navbar-white navbar-light",
    "no_navbar_border": False,
    "navbar_fixed": False,
    "layout_boxed": False,
    "footer_fixed": False,
    "sidebar_fixed": False,
    "sidebar": "sidebar-dark-maroon",
    "sidebar_nav_small_text": False,
    "sidebar_disable_expand": False,
    "sidebar_nav_child_indent": True,
    "sidebar_nav_compact_style": True,
    "sidebar_nav_legacy_style": False,
    "sidebar_nav_flat_style": True,
    "theme": "flatly",
    "dark_mode_theme": None,
    "button_classes": {
        "primary": "btn-outline-primary",
        "secondary": "btn-outline-secondary",
        "info": "btn-info",
        "warning": "btn-warning",
        "danger": "btn-danger",
        "success": "btn-success"
    },
    "actions_sticky_top": False
}