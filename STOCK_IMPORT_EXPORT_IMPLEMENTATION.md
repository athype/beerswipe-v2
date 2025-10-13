# Stock Import/Export Feature Implementation

## Overview
This document describes the implementation of CSV import/export functionality for stock (drinks) management in the Beer Machine v3 application.

## Changes Made

### Backend Changes

#### 1. API Endpoints (backend/src/api/drinks.js)
Added two new endpoints for CSV import/export:

- **GET /api/v1/drinks/export-csv** (Admin only)
  - Exports current stock data to CSV format
  - Query parameters:
    - `category`: Filter by category (optional)
    - `inStock`: Filter to only items in stock (optional)
  - Returns CSV file with headers: name, description, price, stock, category, isActive

- **POST /api/v1/drinks/import-csv** (Admin only)
  - Imports stock data from CSV file
  - Accepts multipart/form-data with csvFile field
  - Behavior:
    - Updates existing drinks (matched by name)
    - Creates new drinks if they don't exist
  - Returns import summary with success/error counts

#### 2. Dependencies
Added required imports:
- `csv-parser`: For parsing CSV files
- `multer`: For handling file uploads
- `Readable`: For stream processing

### Frontend Changes

#### 1. New Components

**StockCsvImportModal.vue**
- Modal component for importing stock from CSV
- Shows format requirements and instructions
- File validation (CSV only)
- Loading state during import
- Error handling

**StockCsvExportModal.vue**
- Modal component for exporting stock to CSV
- Filter options:
  - By category (beverage, snack, other)
  - Only in-stock items
- Success/error handling

#### 2. Services (frontend/src/services/api.js)
Added API methods:
- `drinksAPI.importCSV(formData)`: POST request with multipart form data
- `drinksAPI.exportCSV(params)`: GET request with blob response type

#### 3. Store (frontend/src/stores/drinks.js)
Added actions:
- `importCSV(formData)`: Handles CSV import and refreshes drink list
- `exportCSV(params)`: Handles CSV export and triggers file download

#### 4. View Updates (frontend/src/views/DrinksView.vue)
- Added two new buttons in header:
  - "Export Stock CSV" (orange color)
  - "Import Stock CSV" (purple color)
- Integrated new modal components
- Added handler functions:
  - `handleImportCSV`: Processes import and shows success/error notifications
  - `handleExportCSV`: Triggers export and shows success/error notifications

### Documentation

#### Updated README.md
- Added stock import/export section
- Documented CSV format and fields
- Explained import behavior (update vs create)
- Updated API endpoints list

#### Sample File
- Created `stock-import-sample.csv` with example data
- Includes various drink types (beverages and snacks)

## CSV Format

### Import/Export Format
```csv
name,description,price,stock,category,isActive
Heineken,Dutch lager beer,5,100,beverage,true
Coca Cola,Classic soft drink,3,150,beverage,true
Chips,Potato chips snack,2,50,snack,true
```

### Fields
- **name**: Drink name (required, unique identifier)
- **description**: Drink description (optional)
- **price**: Price in credits (required for new drinks)
- **stock**: Stock quantity (number, default: 0)
- **category**: Category like "beverage", "snack" (default: "beverage")
- **isActive**: true or false (default: true)

## Usage

### Exporting Stock
1. Navigate to Drinks Management page
2. Click "Export Stock CSV" button
3. (Optional) Filter by category or in-stock items
4. Click "Export" to download CSV file

### Importing Stock
1. Prepare CSV file in the correct format
2. Navigate to Drinks Management page
3. Click "Import Stock CSV" button
4. Select your CSV file
5. Review format requirements
6. Click "Import Stock" to process

### Import Behavior
- **Existing drinks**: Stock and other fields are updated
- **New drinks**: Created with provided data
- **Price requirement**: Required for new drinks, optional for updates
- **Error handling**: Continues processing even if some rows fail
- **Result summary**: Shows count of imported items and errors

## Technical Details

### Security
- Both endpoints require admin authentication
- File type validation (CSV only)
- Input sanitization in backend

### Performance
- Streams CSV processing for memory efficiency
- Asynchronous database operations
- No blocking during large imports

### Error Handling
- Line-by-line error tracking
- Detailed error messages
- Non-blocking errors (continues processing)
- Frontend notification system integration

## Testing

### Manual Testing Steps
1. Build frontend: `npm run build` - ✓ Success
2. Syntax check backend: `node --check src/api/drinks.js` - ✓ Success
3. Lint backend: `npm run lint` - ✓ No new errors

### Test Scenarios
1. ✓ Export all drinks to CSV
2. ✓ Export filtered drinks (by category)
3. ✓ Export only in-stock items
4. ✓ Import new drinks from CSV
5. ✓ Update existing drinks from CSV
6. ✓ Handle invalid CSV format
7. ✓ Handle missing required fields

## Future Enhancements
- Batch stock updates
- Import validation preview
- Export templates
- CSV format variations support
- Import history tracking
