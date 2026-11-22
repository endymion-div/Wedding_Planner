# 💍 Wedding Planner

> **Plan. Organize. Celebrate.**  
> A modern, interactive AI-powered wedding planning platform designed to bring every important part of wedding preparation together in one elegant digital experience.

## 🌸 Overview

**Wedding Planner** is a modern web application that simplifies the wedding-planning process by bringing planning tasks, ideas, arrangements, and assistance into a centralized platform.

Instead of managing different aspects of a wedding across multiple applications, users can interact with a single, visually engaging platform to organize their planning journey.

The application combines a **React-based interface**, responsive design, smooth animations, and **Google Gemini-powered AI capabilities** to create an interactive and personalized planning experience.

---

## ✨ Features

### 💒 Wedding Planning

- Centralized wedding-planning experience
- Organized planning sections
- Interactive planning interface
- Easy navigation between different wedding-related areas

### 🤖 AI-Powered Assistance

Powered by **Google Gemini**, the application can be extended to provide intelligent assistance such as:

- 💡 Personalized wedding-planning suggestions
- 🗓️ Planning and scheduling assistance
- 💰 Budget-planning ideas
- 💐 Decoration and theme suggestions
- 🍽️ Menu recommendations
- 📋 Personalized wedding checklists
- 💬 AI-powered planning assistance

### 🎨 Modern UI/UX

- Elegant wedding-inspired interface
- Clean and intuitive layout
- Smooth animations and transitions
- Interactive controls and icons
- Responsive components
- User-friendly navigation

### 📱 Responsive Design

The application is designed to adapt to different screen sizes, including:

- 💻 Desktop
- 🖥️ Laptop
- 📱 Mobile
- 📲 Tablet

---

# 🛠️ Tech Stack

## Frontend

| Technology | Purpose |
|---|---|
| **React 19** | UI development |
| **TypeScript** | Type-safe application logic |
| **HTML5** | Application structure |
| **Tailwind CSS** | Styling and responsive design |
| **Vite** | Development and build tooling |

## UI & Animation

| Technology | Purpose |
|---|---|
| **Lucide React** | Icons |
| **Motion** | Animations and transitions |

## Backend

| Technology | Purpose |
|---|---|
| **Node.js** | Runtime environment |
| **Express.js** | Server-side functionality |
| **tsx** | TypeScript execution |

## AI

| Technology | Purpose |
|---|---|
| **Google GenAI / Gemini API** | AI-powered wedding assistance |

---

# 📁 Project Structure

```text
Wedding_Planner/
│
├── src/
│   ├── components/
│   ├── ...
│   └── ...
│
├── .aistudio/
│   └── artifacts/
│
├── .env.example
├── .gitignore
├── index.html
├── metadata.json
├── package.json
├── server.ts
├── tsconfig.json
├── vite.config.ts
└── README.md
```

> The `src` directory may evolve as additional components and features are introduced.

---

# 🚀 Getting Started

## Prerequisites

Make sure you have the following installed:

- **Node.js**
- **npm**
- A modern web browser
- A Gemini API key if AI functionality requires it

---

## 1️⃣ Clone the Repository

```bash
git clone https://github.com/snehaghosh0015/Wedding_Planner.git
```

## 2️⃣ Navigate to the Project

```bash
cd Wedding_Planner
```

## 3️⃣ Install Dependencies

```bash
npm install
```

## 4️⃣ Configure Environment Variables

Create a `.env` file from the provided example:

```bash
cp .env.example .env
```

Add the required Gemini API configuration:

```env
GEMINI_API_KEY=your_api_key_here
```

> 🔐 **Important:** Never upload your actual API key to GitHub. Keep credentials inside environment variables and ensure `.env` is included in `.gitignore`.

---

# ▶️ Running the Application

Start the development server:

```bash
npm run dev
```

Vite will provide a local development URL in the terminal.

Open that URL in your browser to launch the application.

---

# 🏗️ Production Build

Create an optimized production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

---

# 🧹 Clean Build

Remove generated build files using:

```bash
npm run clean
```

---

# 🔍 Type Checking

Run the project's TypeScript checking command:

```bash
npm run lint
```

This helps identify TypeScript-related issues during development.

---

# 🤖 AI Integration

Wedding Planner integrates the **Google GenAI SDK / Gemini API** to support AI-powered functionality.

The AI layer can be used to transform the application from a simple planning interface into an intelligent wedding-planning assistant.

Potential AI interactions include:

```text
User → Wedding Planning Request
             ↓
       Gemini AI Processing
             ↓
   Personalized Recommendation
             ↓
        User Interface
```

### Example AI Use Cases

- Generate a personalized wedding checklist
- Suggest wedding themes
- Recommend decoration ideas
- Generate menu suggestions
- Help organize wedding timelines
- Provide budget-planning ideas
- Assist with wedding preparation decisions

The Gemini API key should always be stored securely using environment variables.

---

# 🎨 Design Philosophy

Wedding Planner is built around five principles:

### ✨ Elegant

A clean, wedding-focused visual experience designed to feel polished and modern.

### 🧭 Simple

Planning features are organized to make navigation intuitive and easy to understand.

### ⚡ Interactive

Animations, dynamic elements, and responsive controls create an engaging experience.

### 📋 Practical

The application focuses on bringing multiple planning activities into one centralized platform.

### 📱 Responsive

The interface is designed to remain usable across different screen sizes and devices.

---

# 🔮 Future Enhancements

Wedding Planner can be expanded into a complete wedding-management platform with features such as:

- 📅 Wedding timeline and calendar
- 👥 Guest management
- 💌 Digital invitation management
- 💰 Budget tracker
- 💐 Vendor management
- 🏨 Venue management
- 🍽️ Catering management
- 📸 Photography planning
- 🎵 Music and entertainment planning
- 📝 Smart wedding checklist
- 🤖 Advanced Gemini AI assistant
- 👤 User accounts and authentication
- ☁️ Cloud data storage
- 📊 Wedding-planning progress dashboard
- 🔔 Reminders and notifications
- 📈 Budget and planning analytics

---

# 🎯 Project Goals

The primary goal of **Wedding Planner** is to create a centralized digital solution for organizing wedding preparations.

The application aims to reduce the complexity of wedding planning by combining:

**Planning + Organization + AI Assistance + Interactive Design**

into a single platform.

---

# 🌐 Live Demo

🚀 **Try the Wedding Planner:**  
https://ais-pre-6th2sknuoxfqqnimadgjf2-830168134515.asia-east1.run.app/

---

# 📸 Screenshots

Add screenshots of the application here to give visitors an immediate visual overview.

Example:

```markdown
## 📸 Screenshots

![Wedding Planner Dashboard](screenshots/dashboard.png)

![Wedding Planner Interface](screenshots/planner.png)

![AI Wedding Assistant](screenshots/ai-assistant.png)
```

---

# 📦 NPM Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the Vite development server |
| `npm run start` | Starts the application |
| `npm run build` | Creates the production build |
| `npm run preview` | Previews the production build |
| `npm run clean` | Removes generated build files |
| `npm run lint` | Performs TypeScript checking |

---

# 🔐 Environment Variables

The project may require environment variables for AI functionality.

Create a local `.env` file:

```env
GEMINI_API_KEY=your_api_key_here
```

The repository includes:

```text
.env.example
```

as a template.

### Security

Never commit:

```text
.env
```

or any file containing private API credentials.

---

# 👩‍💻 Author

### Sneha Ghosh

**B.Tech CSE (AI & ML)**

Interested in:

- 🤖 Artificial Intelligence
- 💻 Software Development
- 🌐 Web Development
- 🚀 Hackathons
- 🧠 Emerging Technologies

GitHub: **[@snehaghosh0015](https://github.com/snehaghosh0015)**

---

# 📄 License

This project is available for educational and development purposes.

If you plan to reuse, modify, or distribute the project, add an appropriate open-source license to the repository.

---

# ⭐ Support

If you like this project, consider giving the repository a ⭐ on GitHub.

Suggestions, improvements, and contributions are welcome.

---

<div align="center">

### 💍 Plan. Organize. Celebrate.

**Wedding Planner**  
*Bringing wedding planning into one beautiful digital experience.*

</div>
