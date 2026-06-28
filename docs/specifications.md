# SEMS2 (Student Experience Management System) - Complete Requirements Specification

## Executive Summary

SEMS2 is a comprehensive event management application designed for Monash University Malaysia. The system enables students to register for events, organisations to manage events, and administrators to oversee the entire ecosystem with robust security and data privacy controls.

## System Architecture

### Technology Stack

- **Frontend**: SvelteKit 2 + Svelte 5 + supabase-js + shadcn-svelte + TailwindCSS + Lucide
- **Backend**: Supabase (PostgreSQL with Row Level Security)
- **Infrastructure**: Dokploy PaaS on DigitalOcean
- **Email Service**: Resend
- **Hosting**: Self-hosted (data privacy compliance)

### Database Schema Overview

The system consists of 20 tables with comprehensive relationships and security policies:

- Core entities: profile, event, organisation, registration
- Supporting tables: study_program, notification_log, templates
- Lookup tables (LUTs): Various status and type tables

## Core Business Rules

### 1. User Hierarchy & Permissions

#### Profile Roles (Hierarchical)

- **Superadmin** (highest) - Full system access
- **Admin** - Administrative access
- **User** (standard) - Regular user access

#### Organisation Roles (Hierarchical)

- **Owner** (highest) - Full organisation control
- **Leader** - Organisation management
- **Member** (standard) - Basic membership

#### Event Manager Definition

Organisation members with role "Owner" or "Leader" whose organisation owns the event.

### 2. Authentication & User Management

- **Authentication**: Google OAuth OIDC via Supabase Auth
- **User Creation**: Auto-registration with profile creation upon first login
- **Profile Linking**: public.profile.user_id → auth.users.id

### 3. Data Integrity Rules

- **Soft Deletes Only**: All DELETE operations set `deleted_at` and `deleted_by` fields
- **Hard Delete**: Only via direct SQL queries on backend
- **Data Retention**: 7-year retention policy (future cron job implementation)
- **Audit Trail**: All tables (non-LUT) include created_at, created_by, modified_at, modified_by, deleted_at, deleted_by

## Detailed Table Requirements & RLS Policies

### 1. PROFILE Table

Stores additional user information beyond auth.users

#### Schema

```sql
profile_id (UUID, PK)
user_id (UUID, FK → auth.users.id)
study_program_id (UUID, FK)
profile_role_id (UUID, FK)
student_id (int8)
full_name (text)
gender (text)
enrolment_year (integer)
enrolment_intake (integer)
email (text)
profile_update_request (JSON)
[audit fields]
```

#### RLS Policies

| Operation  | Permission Rules                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **SELECT** | All authenticated users can view all profiles                                                                                              |
| **INSERT** | System only (during registration process)                                                                                                  |
| **UPDATE** | • Users: Can only update own `profile_update_request` field<br>• Admin/Superadmin: Can update any field including applying update requests |
| **DELETE** | Soft delete only (see global rules)                                                                                                        |

#### Update Request Format

```json
{
  "full_name": "New Name",
  "student_id": 12345678,
  "field_name": "new_value"
}
```

### 2. REGISTRATION Table

Event registrations linking profiles to events

#### Schema

```sql
registration_id (UUID, PK)
event_id (UUID, FK)
profile_id (UUID, FK)
registration_status_id (UUID, FK)
[audit fields]
```

#### RLS Policies

| Operation  | Permission Rules                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **SELECT** | • Users: Own registrations only<br>• Event managers: Registrations for their events<br>• Admin/Superadmin: All registrations                     |
| **INSERT** | • Users: Can register for approved events<br>• Admin/Superadmin: Can register any user to any event                                              |
| **UPDATE** | • Users: Can update own registration_status_id<br>• System: Can bulk update (e.g., event cancellation)<br>• Admin/Superadmin: Full update access |
| **DELETE** | Soft delete only                                                                                                                                 |

### 3. ATTENDANCE TRACKING (Consolidated into Registration)

Event attendance is tracked directly within the registration table for improved performance and simplified data model.

#### Schema Changes (Effective: Migration 20250926115834)

```sql
-- Added to registration table:
attended BOOLEAN NOT NULL DEFAULT FALSE
attendance_recorded_by UUID REFERENCES auth.users(id)
attendance_recorded_at TIMESTAMPTZ
```

#### RLS Policies

| Operation  | Permission Rules                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| **SELECT** | • Users: Own attendance status<br>• Event managers: Attendance for their events<br>• Admin/Superadmin: All attendance |
| **UPDATE** | • Event managers: Can mark/unmark attendance<br>• Admin/Superadmin: Full access                                         |
| **DELETE** | Follows registration soft-delete rules                                                                                 |

### 4. EVENT Table

Core event information and management

#### Schema

```sql
event_id (UUID, PK)
organisation_id (UUID, FK)
event_state_id (UUID, FK)
event_mode_id (UUID, FK)
name (text)
description (text)
venue (text)
capacity (int8)
note_to_registrants (text)
start_dateTime (timestamptz)
end_dateTime (timestamptz)
registration_opening_dateTime (timestamptz)
registration_closing_dateTime (timestamptz)
registration_url (text)
registration_secret_code (text)
feedback_url (text)
ems_url (text)
ems_number (text)
reviewed_by (UUID)
reviewed_at (timestamptz)
reviewer_notes (text)
event_update_request (JSON)
[audit fields]
```

#### RLS Policies

| Operation  | Permission Rules                                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **SELECT** | • All users: Approved events only<br>• Event managers: Own events (all states)<br>• Admin/Superadmin: All events (all states)          |
| **INSERT** | • Event managers: Create draft events<br>• Admin/Superadmin: Create any state events                                                   |
| **UPDATE** | • Event managers: Draft→Pending transition, update_request field<br>• Admin/Superadmin: Full update including applying update requests |
| **DELETE** | Soft delete only                                                                                                                       |

#### Event States

- `draft` - Initial creation
- `pending` - Awaiting approval
- `approved` - Active and visible
- `rejected` - Not approved
- `cancelled` - Event has been cancelled

### 5. ORGANISATION Table

Organisations that own and manage events

#### Schema

```sql
organisation_id (UUID, PK)
name (text)
description (text)
organisation_update_request (JSON)
[audit fields]
```

#### RLS Policies

| Operation  | Permission Rules                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------ |
| **SELECT** | All authenticated users                                                                          |
| **INSERT** | Admin/Superadmin only                                                                            |
| **UPDATE** | • Organisation Owner/Leader: Update request field only<br>• Admin/Superadmin: Full update access |
| **DELETE** | Soft delete only                                                                                 |

### 6. ORGANISATION_MEMBER Table

Links users to organisations with roles

#### Schema

```sql
organisation_member_id (UUID, PK)
organisation_id (UUID, FK)
profile_id (UUID, FK)
role_id (UUID, FK → organisation_role)
[audit fields]
```

#### RLS Policies

| Operation  | Permission Rules                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| **SELECT** | • Organisation members: Own organisation only<br>• Admin/Superadmin: All memberships                                     |
| **INSERT** | • Organisation Owner/Leader: Add to own organisation<br>• Admin/Superadmin: Add to any organisation                      |
| **UPDATE** | • Owner: Promote to any role in own org<br>• Leader: Promote to Leader only in own org<br>• Admin/Superadmin: Any update |
| **DELETE** | Soft delete only                                                                                                         |

### 7. QR Code System (Simplified)

**Simple QR Code Implementation for Attendance Tracking**

#### Design

The system uses a simple QR code approach where:
- QR codes contain only the `registration_id` (UUID) of the registration
- No complex token generation, hashing, or expiration logic
- Event managers scan QR codes to mark attendance in registration records

#### Flow

1. **QR Code Generation**: When users register for events, they receive a QR code containing their registration UUID
2. **QR Code Display**: Users display the QR code on their device when attending events
3. **Attendance Scanning**: Event managers use the `/scanner` page to scan QR codes
4. **Attendance Marking**: System updates registration records to mark attendance using the scanned registration ID

#### Security Considerations

- **Validation**: Scanner validates that the registration exists and is not deleted
- **Authorization**: Only event managers (organisation owners/leaders) can mark attendance
- **Duplicate Prevention**: System prevents duplicate attendance marking for the same registration
- **Event Context**: Attendance is tracked within registration records which are linked to events

### 8. NOTIFICATION_LOG Table

Email notification tracking

#### Schema

```sql
notification_log_id (UUID, PK)
registration_id (UUID, FK)
notification_status_id (UUID, FK)
template_id (UUID, FK)
attempt_count (int8)
last_attempt_at (timestamptz)
last_error (text)
[audit fields]
```

#### RLS Policies

| Operation  | Permission Rules                                                        |
| ---------- | ----------------------------------------------------------------------- |
| **SELECT** | • System access<br>• Admin/Superadmin: Read access                      |
| **INSERT** | • System: Automated notifications<br>• Admin/Superadmin: Manual entries |
| **UPDATE** | • System: Status updates<br>• Admin/Superadmin: Manual updates          |
| **DELETE** | Soft delete only                                                        |

### 9. TEMPLATE Table

Email templates for notifications

#### Schema

```sql
template_id (UUID, PK)
name (text)
subject (text)
body (text)
```

#### RLS Policies

| Operation  | Permission Rules                                 |
| ---------- | ------------------------------------------------ |
| **SELECT** | • System access<br>• Admin/Superadmin: Full read |
| **INSERT** | Admin/Superadmin only                            |
| **UPDATE** | Admin/Superadmin only                            |
| **DELETE** | Soft delete only                                 |

### 10. Study Program Tables

Educational program hierarchy

#### Tables

- **study_level**: Undergraduate, Postgraduate
- **study_school**: School of Business, School of Science, etc.
- **study_course**: Master of Data Science, Bachelor of Engineering, etc.
- **study_program**: Bridge table linking level, school, and course

#### RLS Policies (All Study Tables)

| Operation  | Permission Rules        |
| ---------- | ----------------------- |
| **SELECT** | All authenticated users |
| **INSERT** | Migration/Admin only    |
| **UPDATE** | Admin/Superadmin only   |
| **DELETE** | Not permitted           |

## Lookup Tables (LUTs)

### Standard LUT Policy

All lookup tables follow these standard policies:

- **SELECT**: All authenticated users
- **INSERT/UPDATE/DELETE**: Migration scripts only
- **RLS**: Enabled but permissive for SELECT

### Complete LUT List

| Table                   | Values                                                                  | Purpose                   |
| ----------------------- | ----------------------------------------------------------------------- | ------------------------- |
| **profile_role**        | Superadmin, Admin, User                                                 | User permission levels    |
| **organisation_role**   | Owner, Leader, Member                                                   | Organisation hierarchy    |
| **event_state**         | draft, pending, approved, rejected                                      | Event workflow states     |
| **event_mode**          | online, hybrid, physical                                                | Event delivery format     |
| **registration_status** | WAITLISTED, CONFIRMED, CANCELLED_EVENT, CANCELLED_USER, CANCELLED_ADMIN | Registration states       |
| **notification_status** | PENDING, SENT, FAILED                                                   | Email delivery status     |
| **study_level**         | Undergraduate, Postgraduate                                             | Academic levels           |
