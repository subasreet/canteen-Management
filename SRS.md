1. Purpose and Scope
Purpose

The purpose of the Canteen Management System is to provide a system for users to log in, view available food items and prices, add items to orders, place and confirm orders, and view order status and order history. The system also allows administrators to manage food items.

In Scope
User login to access the canteen system.
Viewing available food items and prices.
Adding food items to an order.
Placing and confirming food orders.
Viewing order status and order history.
Admin management of food items through add, update, and remove operations.
Out of Scope
Online payment processing.
Food delivery management.
Customer feedback or rating.
Inventory or stock management.
Notifications through SMS or email.
2. Functional Requirements
FR-01: The system shall allow users to log in to access the canteen system.
FR-02: The system shall allow users to view available food items and their prices.
FR-03: The system shall allow users to add food items to an order.
FR-04: The system shall allow users to place and confirm food orders.
FR-05: The system shall allow users to view order status and order history.
FR-06: The system shall allow administrators to add, update, and remove food items.
3. Non-Functional Requirements
NFR-01 – Speed: The system shall display requested food items or prices within 2 seconds under normal operating conditions.
NFR-02 – Speed: The system shall process an order placement request within 3 seconds under normal operating conditions.
NFR-03 – Security: The system shall reject invalid login credentials with 100% accuracy.
NFR-04 – Security: The system shall restrict food-item management operations to authenticated administrators with 100% enforcement.
NFR-05 – Usability: A user shall be able to access the main food-item and ordering functions within 3 clicks from the login screen.
NFR-06 – Reliability: The system shall successfully store 99% or more of confirmed orders without data loss during normal operation.
NFR-07 – Reliability: The system shall maintain order and food-item data consistently across 100% of successful database transactions.
4. Assumptions
Users have valid login credentials.
An administrator is responsible for managing food items.
Food-item names and prices are entered correctly by the administrator.
Users have access to a computer on which the Python application can run.
SQLite is available for storing system data.
5. Constraints
The system shall be developed using Python.
SQLite shall be used as the database.
The first version shall be limited to the six specified functional features.
The system shall not include features outside the stated requirements.