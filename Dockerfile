# Use Node.js base image
FROM node:18

# Install Python + pip
RUN apt-get update && apt-get install -y python3 python3-pip

# Set working directory inside container
WORKDIR /app

# Copy entire project (backend + ML + everything)
COPY . .

# Go to backend folder
WORKDIR /app/backend

# Install Node dependencies
RUN npm install

# ✅ FIXED LINE (important)
RUN pip3 install --break-system-packages -r requirements.txt

# Expose backend port
EXPOSE 5005

# Start backend server
CMD ["node", "server.js"]