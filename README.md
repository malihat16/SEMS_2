# Student Experience Management System (SEMS2)

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-2.16-orange.svg)](https://kit.svelte.dev/)
[![Svelte](https://img.shields.io/badge/Svelte-5.0-ff3e00.svg)](https://svelte.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.0-06B6D4.svg)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791.svg)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-2.55-3ECF8E.svg)](https://supabase.com/)
[![Docker](https://img.shields.io/badge/Docker-2496ED.svg)](https://www.docker.com/)

## Overview

SEMS2 (Student Experience Management System) is a comprehensive event management application designed specifically for Monash University Malaysia. The system enables students to register for events, organisations to manage events, and administrators to oversee the entire ecosystem with robust security, data privacy controls, and comprehensive audit trails.

### Key Features

- **Hierarchical User Management** - Profile roles from Student to Super Admin with granular permissions
- **Event Management** - Complete lifecycle management with approval workflows
- **Organization Management** - Student organization registration and member management
- **QR Code Integration** - Event check-in via QR scanner with real-time attendance tracking
- **Analytics Dashboard** - Comprehensive event analytics and reporting
- **Data Export** - Excel export functionality for registrations and analytics
- **Row Level Security** - Database-level security with Supabase RLS policies
- **Real-time Notifications** - Event updates and system notifications
- **Responsive Design** - Mobile-first design with Tailwind CSS 4.0
- **Comprehensive Testing** - Unit and E2E testing with Vitest and Playwright

## Technology Stack

### Frontend

- **Framework**: SvelteKit 2.16 with Svelte 5.0
- **Language**: TypeScript 5.0+
- **Styling**: Tailwind CSS 4.0 with @tailwindcss/vite
- **UI Components**: Bits UI, shadcn/ui components
- **State Management**: Svelte 5 runes and stores
- **Forms**: SvelteKit Superforms 2.26+
- **Testing**: Vitest 3.0 (unit), Playwright 1.49+ (E2E)
- **Build Tool**: Vite 6.2+

### Backend & Database

- **Database**: PostgreSQL via Supabase with Row Level Security (RLS)
- **Authentication**: Supabase Auth with profile-based role system
- **Real-time**: Supabase Realtime subscriptions
- **API**: Supabase REST API with TypeScript client
- **Database Migrations**: Supabase CLI migration system
- **File Storage**: Supabase Storage (for future features)

### Additional Features

- **QR Code**: QR code generation and scanning (qrcode, qr-scanner)
- **Excel Export**: XLSX export functionality
- **Email**: Integration ready for notification system
- **Charts**: Layerchart for analytics visualization
- **Date Handling**: Internationalized date utilities

### Development Tools

- **Package Manager**: Yarn 4.9.2 with Corepack
- **Code Quality**: ESLint 9.18+, Prettier 3.4+
- **Type Checking**: TypeScript strict mode with svelte-check
- **Containerization**: Multi-stage Docker build with Node.js LTS
- **CI/CD**: Ready for Dokploy PaaS deployment

## Project Structure

```
sems2-prototype/
├── docs/                     # Project documentation
│   └── specifications.md    # Complete requirements specification
├── supabase/                 # Supabase configuration and migrations
│   ├── config.toml          # Supabase project configuration
│   ├── seed.sql            # Database seeding script
│   └── migrations/         # Database migration files
├── frontend/                 # SvelteKit application
│   ├── src/
│   │   ├── lib/             # Shared utilities and components
│   │   │   ├── components/  # Reusable UI components
│   │   │   ├── hooks/       # Custom Svelte hooks
│   │   │   ├── utils/       # Utility functions
│   │   │   ├── auth.ts      # Authentication utilities
│   │   │   ├── database.ts  # Supabase client and queries
│   │   │   ├── types.ts     # TypeScript type definitions
│   │   │   ├── constants.ts # Application constants
│   │   │   └── permissions.ts # Role-based permissions
│   │   ├── routes/          # SvelteKit routes
│   │   │   ├── analytics/   # Analytics dashboard
│   │   │   ├── approvals/   # Event approval workflows
│   │   │   ├── events/      # Event management and browsing
│   │   │   ├── event-create/ # Event creation wizard
│   │   │   ├── event-management/ # Event administration
│   │   │   ├── organisation-management/ # Organization admin
│   │   │   ├── user-management/ # User administration
│   │   │   ├── profile/     # User profile management
│   │   │   ├── register/    # User registration
│   │   │   ├── scanner/     # QR code scanner for check-ins
│   │   │   ├── callback/    # Auth callback handling
│   │   │   └── forbidden/   # Access denied pages
│   │   ├── app.html         # Main HTML template
│   │   ├── app.css         # Global styles
│   │   └── app.d.ts        # App-level type definitions
│   ├── static/              # Static assets
│   ├── e2e/                 # End-to-end tests
│   ├── build/              # Production build output
│   ├── Dockerfile          # Multi-stage Docker configuration
│   ├── package.json        # Dependencies and scripts
│   ├── tsconfig.json       # TypeScript configuration
│   ├── tailwind.config.js  # Tailwind CSS configuration
│   ├── vite.config.ts      # Vite build configuration
│   ├── svelte.config.js    # SvelteKit configuration
│   ├── playwright.config.ts # E2E test configuration
│   └── vitest-setup-client.ts # Unit test setup
└── README.md                # Project documentation
```

## Getting Started

### Prerequisites

- **Node.js** 18.0.0 or higher
- **Yarn** 4.9.2 or higher
- **PostgreSQL** (via Supabase)

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd sems2-prototype
   ```

2. **Install dependencies**

   ```bash
   cd frontend
   yarn install
   ```

3. **Set up Supabase**

   Create a new Supabase project and get your credentials. Then create a `.env` file in the frontend directory:

   ```bash
   cd frontend
   cp .env.example .env
   ```

   Update the `.env` file with your Supabase credentials:

   ```bash
   PUBLIC_SUPABASE_URL=your_supabase_project_url
   PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up the database**

   Use the Supabase CLI to run migrations:

   ```bash
   # Install Supabase CLI if you haven't already
   npm install -g supabase

   # Link to your project (from the root directory)
   supabase link --project-ref your-project-ref

   # Push migrations to your database
   supabase db push

   # Optional: Seed the database with sample data
   supabase db reset --db-url your-database-url
   ```

5. **Start the development server**

   ```bash
   yarn dev
   ```

   The application will be available at `http://localhost:5173`

## Development

### Available Scripts

| Command            | Description                          |
| ------------------ | ------------------------------------ |
| `yarn dev`         | Start development server             |
| `yarn build`       | Build for production                 |
| `yarn preview`     | Preview production build             |
| `yarn test`        | Run all tests (unit + E2E)           |
| `yarn test:unit`   | Run unit tests with Vitest           |
| `yarn test:e2e`    | Run end-to-end tests with Playwright |
| `yarn lint`        | Run ESLint and Prettier checks       |
| `yarn format`      | Format code with Prettier            |
| `yarn check`       | Type check with svelte-check         |
| `yarn check:watch` | Type check in watch mode             |

### Code Quality

This project maintains high code quality through:

- **TypeScript** - Static type checking
- **ESLint** - Code linting and best practices
- **Prettier** - Consistent code formatting
- **Vitest** - Fast unit testing
- **Playwright** - Reliable E2E testing

### Development Workflow

1. Create a feature branch from `main`
2. Make your changes following the coding standards
3. Write tests for new functionality
4. Run the test suite: `yarn test`
5. Ensure code quality: `yarn lint && yarn format`
6. Submit a pull request

## Testing

### Unit Tests

```bash
yarn test:unit
```

### End-to-End Tests

```bash
yarn test:e2e
```

### Test Coverage

```bash
yarn test:unit --coverage
```

## Deployment

### Production Build

```bash
yarn build
```

### Docker Deployment

The application includes a multi-stage Dockerfile optimized for production deployment:

```bash
# Build the Docker image with build args
docker build \
  --build-arg PUBLIC_SUPABASE_URL=your_supabase_url \
  --build-arg PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key \
  -t sems2-prototype \
  ./frontend

# Run the container
docker run -p 3000:3000 sems2-prototype
```

### Dokploy Deployment

The application is configured for deployment on Dokploy PaaS:

1. Push your code to a Git repository
2. Create a new application in Dokploy
3. Configure environment variables
4. Deploy using the provided Dockerfile

## Database Schema

The system uses a comprehensive PostgreSQL schema with 20+ tables and Row Level Security (RLS) policies:

### Core Entities

- **Profile System** - Hierarchical user roles (Student → Event Organizer → Organisation Admin → Super Admin)
- **Organizations** - Student organization management with member roles
- **Events** - Complete event lifecycle with approval workflows
- **Registrations** - Event registration with attendance tracking
- **Study Information** - Academic programs, schools, and courses

### Security Features

- **Row Level Security (RLS)** - Database-level access control
- **Audit Trails** - Comprehensive logging of all actions
- **Soft Deletes** - Data preservation with logical deletion
- **Data Privacy** - GDPR-compliant data handling

### Migration System

Database schema is managed through Supabase migrations in `supabase/migrations/`. Key migrations include:

- Core table creation with RLS policies
- Profile type lookup tables
- Attendance system consolidation
- Permission system updates

For detailed schema information, refer to the migration files in `supabase/migrations/` and the complete specifications in `docs/specifications.md`.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Message Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## Architecture & Design Decisions

### Security-First Approach

- **Database-Level Security**: Row Level Security (RLS) policies ensure data access is controlled at the database level
- **Hierarchical Permissions**: Role-based access with inheritance (Student < Event Organizer < Organisation Admin < Super Admin)
- **Audit Trail**: All actions are logged for compliance and debugging

### Performance Optimization

- **Svelte 5 Runes**: Modern reactive system for optimal performance
- **Multi-stage Docker**: Optimized container builds for production
- **Vite 6**: Fast development and production builds
- **TypeScript Strict Mode**: Compile-time error catching

### Developer Experience

- **Type Safety**: Full TypeScript coverage with generated Supabase types
- **Testing Strategy**: Unit tests with Vitest, E2E tests with Playwright
- **Code Quality**: ESLint, Prettier, and automated formatting
- **Modern Tooling**: Yarn 4 with Corepack, latest dependencies

## Team Members

| Name                          | Student ID | Email                       |
| ----------------------------- | ---------- | --------------------------- |
| Suman Datta                   | 30668786   | sdat0004@student.monash.edu |
| Lim Woo Shen                  | 32879857   | wlim0061@student.monash.edu |
| Maliha Tariq                  | 33473692   | mtar0012@student.monash.edu |
| Taha Fareed                   | 32813473   | tfar0012@student.monash.edu |
| Mohamed shaahid Mohamed Altaf | 33261784   | mmoh0162@student.monash.edu |

## Support

For support, please contact the development team or create an issue in the repository.

## Issues and Bug Reports

We use GitHub Issues to track bugs, feature requests, and project enhancements. When reporting issues:

### Bug Reports

Please include the following information:

- **Description**: A clear and concise description of the bug
- **Steps to Reproduce**: Detailed steps to reproduce the behavior
- **Expected Behavior**: What you expected to happen
- **Actual Behavior**: What actually happened
- **Environment**:
  - OS (Windows/macOS/Linux)
  - Node.js version
  - Browser and version (if applicable)
  - Yarn version
- **Screenshots**: If applicable, add screenshots to help explain the problem
- **Additional Context**: Any other context about the problem

### Feature Requests

When requesting new features:

- **Description**: Clear description of the feature
- **Use Case**: Explain why this feature would be useful
- **Proposed Implementation**: If you have ideas on how to implement it
- **Alternatives Considered**: Any alternative solutions you've considered

### Labels

We use the following labels to categorize issues:

- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Improvements or additions to documentation
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention is needed
- `duplicate` - This issue or pull request already exists
- `wontfix` - This will not be worked on
- `priority:high` - High priority issues
- `priority:medium` - Medium priority issues
- `priority:low` - Low priority issues

### Issue Templates

When creating an issue, please use the appropriate template:

1. **Bug Report Template** - For reporting bugs
2. **Feature Request Template** - For suggesting new features
3. **Documentation Template** - For documentation improvements

### Contributing via Issues

Issues are a great way to contribute to the project:

- Report bugs you encounter
- Suggest new features
- Discuss implementation approaches
- Help triage existing issues
- Provide additional context or reproduction steps

Before creating a new issue, please search existing issues to avoid duplicates.
