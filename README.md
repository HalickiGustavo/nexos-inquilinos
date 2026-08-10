# Nexo Gestão

Create a complete, modern, and production-ready Property Management Web Application (Controle de Inquilinos e Alugueis) designed for landlords and real estate agencies. The application must be localized in Portuguese (PT-BR).

### 1. APPLICATION ARCHITECTURE & SECURITY (Supabase Integration)

- Implement full Multi-tenant architecture. Use Supabase Auth for user signups/logins. 

- Crucial: Every table must strictly enforce Row Level Security (RLS) so that a logged-in User/Landlord can ONLY see, create, update, or delete their own data (properties, tenants, contracts, financial records).

### 2. CORE DATABASE STRUCTURE & ENTITIES

The app must manage and relate the following tables in Supabase:

- **Properties (Imóveis):** Address, Type (House, Apartment, Commercial), Rent Price, Condo Fee, IPTU, Status (Available, Rented).

- **Tenants (Inquilinos):** Full Name, CPF/CNPJ, Email, Phone, Emergency Contact.

- **Contracts (Contratos):** Links 1 Property to 1 Tenant. Includes Start Date, End Date, Rent Due Day (1-31), Readjustment Index (IGP-M/IPCA), and Security Deposit value.

- **Financial Installments (Parcelas Financeiras):** Auto-generated when a contract is created (e.g., 12 installments for a 12-month contract). Fields: Due Date, Amount, Paid Amount, Payment Date, Status (Pendente, Pago, Atrasado), and Notes (for adding variable expenses like water/electricity).

- **Maintenance (Manutenções):** Title, Description, Property Link, Cost, Status (Pendente, Em Andamento, Concluído), Responsible Party (Landlord/Tenant).

### 3. USER INTERFACE & SCREENS (UI/UX)

Design a clean, modern dashboard layout using a sidebar navigation. Use standard Tailwind/Shadcn components with a professional color scheme (Emerald green for active metrics/financials, Slate/Zinc for dark typography and clean layout).

- **Dashboard (Visão Geral):**

  - High-level metric cards: Total Revenue to Receive this month, Total Already Paid, Total Overdue (Inadimplência), and Occupancy Rate (%).

  - A quick list or badge showing properties that are currently "Vago" (Available).

  - A modern layout with visual charts/progress bars for monthly financial collection status.

- **Properties Management (Imóveis):**

  - CRUD interface with an optimized layout to list, view, add, or edit properties.

  - Filter by status (Alugado / Disponível).

- **Tenants Management (Inquilinos):**

  - Simple, robust CRUD for listing and creating tenants with clean form validations.

- **Contracts & Financials (Contratos e Finanças):**

  - A wizard or clean form to bind a tenant to a property and create a contract. Upon saving, auto-populate the future monthly payments for that contract duration.

  - A comprehensive Financial Tab listing all installments across all properties.

  - Quick action buttons on each installment row: "Marcar como Pago" (updates status to Pago and saves current timestamp) and "Adicionar Taxa Extra" (opens a dialog to append water/power bills to that month's rent).

- **Maintenance/Support Tab (Manutenções):**

  - Kanban board or clear list showing ongoing repairs, pending budgets, and historical fixes per property.

### 4. TECHNICAL EXPECTATIONS & INTERACTION

- All UI strings, tables, forms, buttons, and system feedbacks MUST be completely written in Portuguese (PT-BR).

- Format all currencies to Brazilian Real (BRL, e.g., R$ 1.500,00) and dates to DD/MM/YYYY.

- Ensure state management is reactive: when an installment is marked as "Pago", the Dashboard metrics must instantly update.

- Ensure responsive design (optimized for Desktop but fully scrollable and usable on Mobile screens).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://nexos-inquilinos.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/231b8419-e2f6-4a97-8769-d585255d26c4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
