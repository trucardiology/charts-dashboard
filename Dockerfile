# Stage 1: Build the application
# Use a slim Node.js base image
FROM node:20-slim AS builder

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to install dependencies
# We copy these first to leverage Docker layer caching if dependencies haven't changed
COPY package.json ./

# Install application dependencies
# The --omit=dev flag is optional but recommended for production images
RUN npm install --omit=dev

# Copy the rest of the application source code
# This includes server.js and the public/ folder
COPY . .

# Create the data directory where SQLite will store app.db
# This ensures the directory exists and has the correct permissions.
RUN mkdir -p data

# Stage 2: Final image (optional, but creates a smaller production image)
# We can use the same slim base image
FROM node:20-slim

# Set the working directory
WORKDIR /usr/src/app

# Copy the installed dependencies and application code from the builder stage
COPY --from=builder /usr/src/app .

# Expose the port the application runs on (default is 3000 in server.js)
EXPOSE 3000

# Specify the command to run the application when the container starts
CMD [ "npm", "start" ]
