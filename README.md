# About
AxionNode is an open-source social platform consisting of:
- A Python Django backend
- Nginx reverse proxy
- A React Native + Expo mobile/web frontend
- Optional Docker containerization

It is designed for self-hosting and can generate iOS, Android, and static web builds from the same codebase. The platform integrates cleanly with Google Cloud Platform (GCP) using:
- Cloud Run (hosting)
- Cloud Build (CI/CD and container builds)
- Cloud SQL PostgreSQL
- GCP Bucket for static & media files

AxionNode originally began as SocialBook, and the backend package still uses the socialbook name as a tribute to its origins.

# Credits
Copyright 2025 Clockwork Venture Inc.
Created by Michael Neil McWilliam

## License
This project is **dual-licensed**:

**Community Edition:** [AGPL v3.0]
- Free for personal, academic, or commercial use as long as modifications are open-sourced
- Source-available
- Copyleft applies to network use (standard AGPL rules)

- **Commercial Edition:** 
For organizations or developers who need:
- Closed-source modifications
- Private forks
- Proprietary hosting
- Enterprise support
- See the full license: (./LICENSE-COMMERCIAL.md)

Email: licensing@axionnode.com for details.

By contributing to this repository, you agree that your contributions will be licensed under AGPL-v3 for the Community Edition.

## Third-Party Notices

This project incorporates certain third-party services and dependencies:

YouTube IFrame API:
The frontend uses libraries that rely on the YouTube IFrame API, which is governed by Google’s Terms of Service.
Use of YouTube content must comply with Google’s policies regardless of your AxionNode license.

Open-source Dependencies:
This project includes dependencies licensed under:
- MIT
- Apache-2.0
- BSD / 0BSD
- Other permissive OSS licenses

All required notices are included via npm/pip dependency metadata and/or compiled build artifacts.

# Technology Stack
- Reverse proxy - Nginx - Runs on port 8080 - Reverse proxies to backend /api/ on Django
- Web Frontend - React Native Expo (iOS, Android, Web) - Generated to static html
- iOS App - React Native Expo deployed through app store - hits Django backend apis 
- Web App - React Native Expo deployed through app store - hits Django backend apis 
- Backend - Django - Runs on port 8000
- Email - Sendgrid/Twilio
- Database - Relational PostgreSQL Database hosted in GCP
- Static files - Stored in GCP Bucket 

# Directory structure
axion-node
- /frontend - Contains all frontend code
- /socialbook - Contains Backend Django code
    - /core - Contains the core models used in the database
    - /api - API views, serializers, and urls
    - /socialbook - Contains django Settings.py
    - manage.py - Core manage.py file used for django commands
    - /venv - Python virtual environment - Can be recreated as needed 
cloudmigrate.yaml - Build and deploy script
Dockerfile - Controls docker settings
nginx.conf - Controls nginx settings
supervisord.conf - Controls services setup on docker image  

# Dependencies - Before running locally 
You must have the following installed and configured properly: 
- Python /w pip
    - All requirements under the requirements.txt will need to be installed properly in your project 
    - Your project will need to select the interpreter in your venv correctly too
- Repo codebase cloned to your device 
- Google Cloud Platform (GCP) account (if you intend to run it in GCP)
    - New GCP Project created 
    - PostgreSQL database running in Cloud SQL 
    - Secret Manager with an entry that you can reference in your backend settings (securely store any secrets in here)
- MacOS with xCode and devtools if you intend to run on iOS

# Running in local dev - Backend: Connecting to Cloud SQL PostgreSQL Database
1. Run the cloud proxy (mac version)
The application is designed to run with a cloud database, such as a PostgreSQL DB, and this example creates a proxy to connects you to your Cloud SQL PostgreSQL database instance. First you must have setup a Cloud SQL PostgreSQL database in Google Cloud Platform
```
# Make sure you're in the socialbook directory
cd socialbook 

# Run the proxy (MacOS)
# If you are on MacOS, run the Mac variant of the proxy 
# Update the variables in the command to your corresponding environment settings
./cloud_sql_proxy_mac -instances="project-id:region-name:db-instance"=tcp:5432

# Run the proxy (Linux)
# If you are on linux, run the linux variant of the proxy 
# Update the variables in the command to your corresponding environment settings
./cloud_sql_proxy_linux -instances="project-id:region-name:db-instance"=tcp:5432
```

2. Set your backend gcp db environment variables correctly: 
```
# Depending on your environment, to start your backend you need to be in the socialbook directory (cd socialbook) and then set your environment variables properly for your GCP environment. 

# These should be updated accordingly to your backend DB settings
export GOOGLE_CLOUD_PROJECT=project-id  
export USE_CLOUD_SQL_AUTH_PROXY=true
```

3. Run the backend from the socialbook directory (cd socialbook)
For this application and to have the simulators connect to our Django instance, we want to run the Django backend and enforce it to listen on all interfaces - not just localhost or 127.0.0.1
NOTE THAT WE HAVE SWITCHED THIS TO USE PORT 8000 AND HAVE OPTED TO USE NGINX AS A REVERSE PROXY BECAUSE CLOUD RUN CAN ONLY EXPOSE 1 PORT, WHICH WE'VE CHOSEN 8080 FOR NGINX, BUT THE BACKEND WILL RUN ON PORT 8000 
You need to go into your socialbook backend directory and initialize the venv first:
```
cd socialbook

# Activate a virtual environment
source venv/bin/activate

# Install and upgrade pip
pip install --upgrade pip

# Install all requirements into your project
pip install -r requirements.txt

# Run the backend server and bind to all IP's and run it on port 8000
python manage.py runserver 0.0.0.0:8000
```

4. DB model updates are all done through ORM migrations via Django
Note: collectstatic is used for copying all static files to the core socialbook GCP bucket. 
```
python manage.py makemigrations
python manage.py migrate
python manage.py collectstatic
```

# Running in local dev - Frontend: How to run the frontend react native expo app
5. Run the frontend react/exo app (from the frontend directory - cd frontend)
```
npx expo start
```

6. Test the frontend on Web, Android and iOS
WARNING: YOU NEED TO BE ON A MAC TO TEST ON IOS AND YOU ALSO NEED TO HAVE THE APPROPRIATE XCODE AND ANDROID STUDIO PRODUCTS INSTALLED, ALONG WITH A VIRTUAL SIMULATOR/DEVICE THAT YOU WANT TO TEST ON. 
```
Test on iOS by pressing the letter i
Test on Android by pressing the letter a
Test on Web by pressing the letter w 
```

# Create a docker build using Cloud Build via Google Cloud Platform (GCP)
7. In order to easily run the build in Google Cloud Platform, we must first submit a build to Cloud Build. Here is the command to do that: 
```
gcloud builds submit --config cloudmigrate.yaml \
--substitutions _INSTANCE_NAME=db-instance,_REGION=region-name \
--service-account projects/project-id/serviceAccounts/named-service-account@project-id.iam.gserviceaccount.com \
--gcs-log-dir=gs://projectname-build-logs/
```

# Deploying the project in Cloud Run
8. Deploying to Cloud Run command: 
Here we take the cloud build that we just created and run it using Cloud Run.
Replace the variables in the command with your own.
```
gcloud run deploy web-service-name \
    --image=region-name-docker.pkg.dev/$PROJECT_ID/repo-name/web-service-name \
    --platform=managed \
    --region=region-name \
    --add-cloudsql-instances project-name:region-name:db-instance \
    --allow-unauthenticated
```