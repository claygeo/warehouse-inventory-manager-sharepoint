# Inventory Manager

An Electron-based desktop app for inventory management, integrated with Supabase for authentication and data syncing, and Supabase for offline queuing. It supports inventory transfers, staging requests, transaction updates, and reports, with a user-friendly dashboard.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Database Setup](#database-setup)
- [Visuals](#visuals)
- [Notes](#notes)

## Features

- Supabase-based authentication with nickname support
- Forms for Transfer In/Out, Staging Request, Transaction Updates, Inventory Display, Staging Updates, Product Master, and Reports
- Offline queuing with Supabase and periodic syncing (every 5 minutes)
- Tailwind CSS and Flatpickr for a polished UI
- Cross-platform support (Windows, macOS, Linux)

## Prerequisites

- Node.js and npm
- Supabase account with SUPABASE_URL and `SUPABASE_ANON_KEY environment variables
- Electron for desktop app development

## Setup

1. Clone the repository: git clone https://github.com/claygeo/warehouse-inventory-manager.git
2. Navigate to the project directory: cd inventory-manager
3. Install dependencies: npm install
4. Create a .env file with Supabase credentials
5. Start the app: npm run start
6. Build for distribution: npm run build

## Database Setup

To configure the Supabase database for the project, you need to create the necessary tables. Copy and paste the following SQL code into the Supabase SQL Editor (found in your Supabase dashboard under SQL Editor). This will set up the components and count_history tables required for the application: 

-- Enable UUID extension for count_history table
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create components table
CREATE TABLE components (
    id TEXT PRIMARY KEY,
    barcode TEXT NOT NULL,
    description TEXT NOT NULL,
    total_quantity INTEGER DEFAULT 0,
    3pl_quantity INTEGER DEFAULT 0,
    ftp_quantity INTEGER DEFAULT 0,
    hstd_quantity INTEGER DEFAULT 0,
    mtd_quantity INTEGER DEFAULT 0,
    quarantine_quantity INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (id IS NOT NULL),
    CHECK (barcode IS NOT NULL),
    CHECK (description IS NOT NULL),
    CONSTRAINT unique_barcode UNIQUE (barcode)
);

-- Create count_history table
CREATE TABLE count_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    count_session TEXT NOT NULL,
    count_type TEXT NOT NULL CHECK (count_type IN ('initial', 'adjustment', 'verification')),
    quantity INTEGER NOT NULL,
    location TEXT,
    CHECK (id IS NOT NULL),
    CHECK (count_session IS NOT NULL),
    CHECK (count_type IS NOT NULL),
    CHECK (quantity IS NOT NULL)
);

## Visuals

Login:
![image](https://github.com/user-attachments/assets/734e074e-b4b6-4275-9cd6-b4dd4be7bd3b)

Location:
![image](https://github.com/user-attachments/assets/ec35bdfb-8e96-4106-b4f5-e42c046a09fb)

Main Dashboard: 
![image](https://github.com/user-attachments/assets/a4b476b7-10b3-425c-aca3-626654d9883c)

Graphs: 
![image](https://github.com/user-attachments/assets/9f34acb3-af25-4743-83cf-c37d3777c1da)
![image](https://github.com/user-attachments/assets/65033a0e-e631-4525-8a36-3437b06e8b2e)
![image](https://github.com/user-attachments/assets/328669df-43ce-423d-97c4-4f221d164fb5)

Generate Labels
![image](https://github.com/user-attachments/assets/da566d63-3509-4998-8b15-6d4d72818774)

Print Settings:
![image](https://github.com/user-attachments/assets/55cb6232-04e6-4272-a893-df24086e89d1)

Monthly Count:
![image](https://github.com/user-attachments/assets/801f1a8f-d869-4ed6-8f3d-47b808d33ead)

Weekly Count:
![image](https://github.com/user-attachments/assets/64572642-ecff-4dca-bdd8-af9f3d581d71)

Audit Trails:
![image](https://github.com/user-attachments/assets/3f3d91b5-d259-4bfb-97f7-e98a114a924d)

## Notes
- Curaleaf branding is used with permission.
- Ensure .env is not committed (excluded via .gitignore).
- The app supports offline operations with automatic syncing when online.
