# --- BACKEND BUILD STAGE ---
FROM --platform=linux/amd64 python:3.13-bookworm AS backend

ENV APP_HOME /app
WORKDIR $APP_HOME
ENV PYTHONUNBUFFERED 1

# Install required system packages
RUN apt-get update && apt-get install -y \
    curl \
    lsb-release \
    gnupg \
    supervisor \
    nodejs \
    npm \
    nginx \
    && rm -rf /var/lib/apt/lists/*

# Create a virtual environment inside the container
RUN python -m venv /app/venv

# Activate the virtual environment and install dependencies
COPY socialbook/requirements.txt .
RUN /app/venv/bin/pip install --no-cache-dir -r requirements.txt

# Copy Django project files
COPY socialbook /app/socialbook

# --- FRONTEND BUILD STAGE ---
FROM node:18 AS frontend

WORKDIR /frontend
COPY frontend /frontend

# Accept the build argument for the API URL
ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL

# Run build and then copy app-ads.txt manually to the dist folder
RUN npm ci && npm run build && \
    cp public/app-ads.txt dist/app-ads.txt && \
    cp public/opengraph.png dist/opengraph.png && \
    cp public/profile_icon.png dist/profile_icon.png

# --- FINAL STAGE ---
FROM --platform=linux/amd64 python:3.13-bookworm

WORKDIR /app

# Copy Django files from the backend stage
COPY --from=backend /app /app

# Install dependencies inside the virtual environment
RUN python -m venv /app/venv
COPY socialbook/requirements.txt .
RUN /app/venv/bin/pip install --no-cache-dir -r requirements.txt

# Copy frontend build files
COPY --from=frontend /frontend/dist /app/frontend/build

# Install and run NGINX as a Reverse Proxy 
RUN apt-get update && apt-get install -y nginx supervisor 
COPY nginx.conf /etc/nginx/nginx.conf

# Copy Supervisor configuration
COPY supervisord.conf /etc/supervisord.conf

# Set environment variables
ENV PATH="/app/venv/bin:$PATH"
ENV PYTHONPATH="/app/socialbook"

# Debug step - Check if Django is installed
RUN /app/venv/bin/python -m pip freeze
RUN /app/venv/bin/python -c "import django; print(django.get_version())"

# Expose necessary ports
EXPOSE 8080

# Start Supervisor, using the virtual environment's Python
CMD ["supervisord", "-c", "/etc/supervisord.conf"]