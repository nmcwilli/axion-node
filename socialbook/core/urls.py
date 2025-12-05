# Revisions and modifications to licensed content Copyright 2023 Clockwork Venture Inc. 
# Release: AxionNode Backend (AKA SocialBook)
# Description: An open-source social platform
# Author: Michael Neil McWilliam


from django.urls import path, include
# from blog.views import *
# from submissions.views import *
# from documentation.views import *
from . import views as core_views


app_name = 'core' 

urlpatterns = [ 

    # core website sections
    path('', core_views.IndexView.as_view(), name='index'),
    # path('about/', core_views.AboutView.as_view(), name='about'), 
    # path('terms/', core_views.TermsView.as_view(), name='terms'), 
    # path('privacy/', core_views.PrivacyView.as_view(), name='privacy'), 
    # path('contact/', core_views.contact_view, name='contact'), 
    # path('register/', core_views.registerTenant, name='register')
]