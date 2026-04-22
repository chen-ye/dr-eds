# drEDS Project Overview

drEDS is an open-source Progressive Web Application (PWA) designed to interface with EDS OX EQ/OX YQ/OX 2.0/TX/GeX electronic derailleur systems. It is hosted via a static web server or PHP backend. The application communicates with bicycle hardware using the **Web Bluetooth** API, enabling users to view battery voltages, shift gears, configure gear values, adjust limits, and create presets. It also includes offline functionality handled by a Service Worker.

## Project Structure & Architecture

- **Frontend:** Built with vanilla HTML (`index.html`), CSS (`css/style.css`), and JavaScript using jQuery (`js/jquery-3.1.1.min.js`).
- **Logic:** The primary application logic handling Bluetooth connections, UI updates, and device configuration is contained within `js/functions.js`.
- **PWA Capabilities:** The application utilizes a Service Worker (`sw.js`) to cache resources for offline use. Configuration for the app installation is found in `manifest.json`.
- **Backend (Optional):** A lightweight PHP script (`upload.php`) exists to receive and store debug logs uploaded from the client application.
- **Localization:** Multilingual support is managed via files in the `lang/` directory.

## Building and Running

This project does not require a complex build process or bundler (like Webpack or Vite) as it consists of static assets.

**To run the frontend locally:**
1. Serve the project root directory using any local HTTP server.
   * Using Python: `python3 -m http.server`
   * Using Node.js: `npx serve`
2. **Important Note on Web Bluetooth:** The Web Bluetooth API requires a secure context. You must serve the application over `https://` or access it via `http://localhost` / `http://127.0.0.1`.

**To run with the log upload functionality:**
1. Use a local PHP development server: `php -S localhost:8000`
2. Ensure the `/tmp` directory is writable for the `upload.php` script to store log files, or configure your environment accordingly.

## Development Conventions

* **JavaScript:** The project uses standard ES5/ES6 Javascript with jQuery for DOM manipulation. All major interactions and state management occur within `js/functions.js`.
* **CSS/Styling:** Styling is primarily handled in `css/style.css` without preprocessors (like SASS/SCSS). It features both Light and Dark theme support that follows the device's preferences.
* **Testing:** There are no explicit automated test suites (e.g., Jest or Mocha) visible in the repository. Testing primarily involves manual validation using an actual Bluetooth-enabled device or an environment set up for Bluetooth sniffing (as detailed in `HOWTO.md`).
* **Contribution/Debugging:** 
   - `HOWTO.md` provides detailed instructions for sniffing Bluetooth traffic using tools like nRF sniffer for Bluetooth and Wireshark.
   - The UI includes an embedded `textarea.debug` for capturing and exporting logs. Logs can be copied to the clipboard and optionally uploaded to the server via the `upload.php` endpoint to aid in troubleshooting.
