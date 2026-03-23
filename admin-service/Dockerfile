# Use Python 3.10 (or higher) because aisuite requires >= 3.10
FROM python:3.10-slim

# Set the working directory in the container
WORKDIR /app

# Copy only the requirements first, to leverage Docker layer caching
COPY requirements.txt .

# Install system dependencies for pdf2image (poppler-utils)
RUN apt-get update && apt-get install -y poppler-utils && apt-get clean

# Install Python dependencies
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copy the rest of the application code
COPY . /app

# Expose the port FastAPI or your app will run on
EXPOSE 8100

# Start the app
CMD ["python", "app.py"]
