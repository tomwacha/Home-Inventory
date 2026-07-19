# Product Brief: Home Inventory App
# 1. Executive Summary
This mobile application allows users to capture item details, snap and automatically downscale photos, and generate clean Google Sheets lists and PDF reports entirely offline. For cloud storage and synchronization, the app bypasses complex database backends (like Firebase) by leveraging the user's free Google Workspace ecosystem (Google Sheets and Google Drive) via a lightweight API gateway using Google Apps Script.

# 2. Core Architecture & Tech Stack
- Frontend Framework: React Native with Expo (Managed Workflow)
- Programming Language: TypeScript (Enforcing strict types)
- Navigation & Routing: Expo Router (app/ file-based routing)
- Local Processing: Device-native PDF generation and system file sharing
- Cloud Integrations: Google Drive (Blob/Image storage) and Google Sheets (Structured data tracking)

# 3. Detailed Feature Breakdown
- General UX Principles:
The app should have a clean, simple and modern look. It should use Expos included icons and react-native-svg.
## Feature 1: Header
- The app has a stationary header at the top with the title  “Home Inventory”.
- To the right of the title is a drop down selector to select the house. The selector reads the houses previously entered. Selecting a house takes you to the main house page.
## Feature 2: Welcome Screen
- When first loaded the app has two buttons.
-- “Add House” shows the Add House screen that allows the user to enter the name of a house. This creates a new record for that house with a new folder using the name of the house on the phone within the app folder. This is the folder the data and images are stored in on the phone. 
-- “View House” is a dropdown listing the existing houses. Selecting one loads the main house page.
## Feature 3: House Main Page
- The main house page shows the name of the house, the total number of items and the total value of the items in the house at the top of the page. 
- There is a search bar under the name of the house and the total items and value. Searching for an item will filter the items in the house based on the title and description fields and expand the items in that house.
- An X button to the right of the search bar will clear out the filter. 
- It displays a list of rooms in the house alphabetically. Selecting a room takes you to the Room page. 
- There is an Export button that will pull up the Export Page.
- There is an Import button that will pull up the Import Page.
## Feature 4: Room Page
- If a room does not have any items a “Add item” button is shown. Selecting this brings up the Add Item page.
- The items are listed alphabetically by item name in a scrollable list. The fields for the items are:
-- Thumbnail image
-- Name
-- Brand
-- Category 
-- Purchase Price (in USD)
- Selecting an item brings up the item page.
## Feature 5: Item Page
- The item page displays
-- Full image
-- Name
-- Brand
-- Category (drop down selection)
-- Purchase Price (in USD)
-- Purchase Year
-- Description
- There is an Edit Item button at the bottom of the page. Selecting that opens the Edit Item page.
- The category list is populated from the category page. There is a new category option at the bottom of the list. This opens the category page. 
## Feature 6: Edit Item Page
- This page allows each field to be edited. There is a Save and Cancel button at the bottom.
## Feature 7: Add Item Page
- This page allows each field to be populated. There is a Save and Cancel button at the bottom.
- The image is blank. Selecting the image will give the user the option to either take a picture with the camera on the phone or select a picture from the phone. 
- Once the picture is taken it displays the image.
## Feature 8: Category Page
- The category page has a list of categories and a button to add category.
- Selecting “Add Category” allows the user to enter a new category name. There is an Add button to confirm.
- Selecting a category allows the user to change the name of that category. There is a Save button to confirm. 
## Feature 9: Export Page
- The export page allows users to export the inventory. They can select between PDF or Google Sheets. 
- The export file is saved to a specific Google Drive folder the user selects.
## Feature 10: Import Page
- The import page allows users to import an existing inventory. 
- The user selects the inventory from a Google Sheet and it is imported.
## Feature 11: Camera Capture & Image Optimization
- Technical Implementation: Uses expo-image-picker.
- Downscaling Rule: Images must be compressed and resized locally immediately after capture (e.g., maximum width/height of 1024px, JPEG quality set to 0.7) to save local device storage, accelerate network sync, and prevent memory crashes.
## Feature 12: Offline Item Management & Thumbnail List
### Technical Implementation:
- Images are saved locally to the device's persistent document directory using expo-file-system.
- Item text data and local file paths are stored on-device using expo-secure-store or an embedded SQLite database (expo-sqlite).
- The dashboard relies entirely on local storage, meaning the app remains 100% functional without an active internet connection.
## Feature 13: Document Generation (PDF & CSV Export)
- PDF Generation: Uses expo-print. The app injects local item variables and base64-encoded optimized image data into a clean HTML/CSS template, converting it natively into a shareable PDF document.
- CSV Generation: The app converts the list of item data arrays into a comma-separated text string (.csv) entirely within TypeScript utility logic.
- Native Share Sheet: Uses expo-sharing. Once generated, the app opens the iOS/Android system dialog, letting the user instantly email, text, or drop the files into their local device folder structure.
## Feature 14: Two-Way Google Workspace Cloud Sync
- The Architecture: The app communicates with a single endpoint URL generated by Google Apps Script bound directly to the target Google Sheet.
### Outbound Sync (Upload):
The app sends a structured JSON payload to the Apps Script endpoint containing the text data and the downscaled image encoded as a Base64 string.
- The script uploads the raw image data to a specific Google Drive folder and retrieves its public view URL.
- The script checks to ensure the items is not already in the Google Sheet. If any of them are, it asks the user if they want to override or ignore the detected items. 
- For all new items or duplicated items the user has chosen to override, the script appends a new row to the Google Sheet, populating columns for metadata along with the public Drive image URL for the new items and replaces any existing items that are overridden. 
### Inbound Sync (Download/Read):
- Upon user pull-to-refresh, the app sends a GET request to the Apps Script endpoint.
- The script reads the spreadsheet rows, constructs a clean JSON array, and returns it to the phone.
- The app updates its local storage and fetches the network image thumbnails using the Google Drive URLs provided.

# 4. Phase 1 Implementation Roadmap
- Milestone 1: Initialize the Expo TypeScript project template and build out the local UI layout (Forms, List Dashboard, Thumbnail display components).
- Milestone 2: Integrate native device hardware modules (expo-image-picker, expo-file-system, and expo-print) to establish fully functioning offline PDF exports.
- Milestone 3: Deploy the Google Apps Script spreadsheet gateway and connect the Expo network layer to execute seamless two-way data syncing.
