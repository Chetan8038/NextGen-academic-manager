# 🎓 MITS Smart Campus ERP & Anti-Proxy Attendance System

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)
![EJS](https://img.shields.io/badge/EJS-B4CA65?style=for-the-badge&logo=ejs&logoColor=black)

A comprehensive, high-security **Smart Campus Management System** built initially for MITS Gwalior. This Monolithic MVC application eliminates attendance proxies using advanced GPS geofencing and dynamic QR codes, while also providing a full suite of ERP tools for Students, Professors, and Campus Management.

## 🚀 Key Features

### 🛡️ Military-Grade Anti-Proxy System
*   **Dynamic QR Generation:** QR codes refresh every 15 seconds via WebSockets (`Socket.io`).
*   **GPS Geofencing:** Haversine formula strictly restricts attendance marking within a **50-meter radius** of the professor's live location.
*   **Strict Device Binding:** One student account is locked to one physical device (Mobile ID).
*   **Single Session Login:** Prevents dual-app or multi-device login simultaneously.
*   **Anti-Screen Capture:** Disables right-click and detects window blurring/minimizing to stop screen-sharing proxies.

### 👨‍🏫 Professor Dashboard
*   **Live Analytics:** Real-time dashboard showing overall department attendance, active courses, and classes conducted.
*   **Exportable Reports:** Advanced CSV data exports with branch and semester-level filtering.
*   **Faculty & Schedule Manager:** Interactive timetable management and peer faculty directories.
*   **Certificate Generation:** Bonafide and NOC management interface.

### 👨‍🎓 Student Dashboard
*   **Live Attendance Tracking:** Visual representation using `Chart.js` (Pie and Bar charts) and a visual Monthly Calendar.
*   **Proctored Quizzes:** Secure quiz taking environment with tab-switch warnings and auto-submission algorithms.
*   **Infrastructure Management:** Report broken campus assets (Electrical, Furniture, Plumbing) with image uploads (Base64) directly to the management team.

### 🛠️ Management Dashboard
*   **Infrastructure Ticketing:** View real-time student complaints with photographic evidence, exact locations (Building/Floor/Room), and statuses (Pending/Resolved).

## 💻 Tech Stack
*   **Backend:** Node.js, Express.js
*   **Database:** MongoDB (Mongoose ORM)
*   **Frontend:** HTML5, CSS3, EJS (Embedded JavaScript)
*   **Real-time Engine:** Socket.io
*   **Libraries:** Chart.js (Analytics), Html5Qrcode (Scanner), UUID (Session tracking)

## ⚙️ Installation & Setup

1. **Clone the repository**
   ```bash
   git clone [https://github.com/your-username/mits-smart-campus-erp.git](https://github.com/your-username/mits-smart-campus-erp.git)
   cd mits-smart-campus-erp