# Trainer AI

## About
A comprehensive fitness and nutrition tracking application powered by AI coaching.

## Features
- **Smart Workouts**: Track your training sessions with an interactive interface.
- **AI Coach**: Get real-time advice and motivation from your personalized AI trainer.
- **Nutrition Tracking**: Log meals and monitor your daily nutrition goals.
- **Progress Monitoring**: Visualize your fitness journey with detailed statistics.

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (running locally or a cloud instance)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd trainer
    ```

2.  **Install dependencies:**
    
    Front-end:
    ```bash
    npm install
    ```
    
    Back-end:
    ```bash
    cd server
    npm install
    cd ..
    ```

3.  **Environment Setup:**
    
    Create a `.env` file in the `server` directory:
    ```env
    PORT=5000
    MONGO_URI=mongodb://localhost:27017/trainer
    JWT_SECRET=your_super_secret_key
    ```
    *(Note: A default `.env` is provided, but you should change the secret for production)*

### Running the App

You can run both the frontend and backend concurrently:

```bash
npm run dev:full
```

Or run them separately:
- **Backend**: `npm run server`
- **Frontend**: `npm run dev`

## Technologies
- **Frontend**: React, Vite, TailwindCSS, Framer Motion
- **Backend**: Node.js, Express, MongoDB, Mongoose
- **AI**: Custom integration (Placeholder for OpenAI/Anthropic)
