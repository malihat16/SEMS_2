// Database Types based on the CREATE.sql schema

export interface StudyLevel {
	study_level_id?: string;
	name: string;
	description?: string | null;
}

export interface StudySchool {
	study_school_id?: string;
	name: string;
	description?: string | null;
}

export interface StudyCourse {
	study_course_id?: string;
	name: string;
	description?: string | null;
}

export interface StudySchoolCourse {
	study_school_course_id: string;
	study_school_id: string;
	study_course_id: string;
	description?: string | null;
	study_school?: StudySchool;
	study_course?: StudyCourse;
}

export interface StudyProgram {
	study_program_id: string;
	study_level_id: string;
	study_school_id: string;
	study_course_id: string;
	description?: string | null;
	study_level?: StudyLevel;
	study_school?: StudySchool;
	study_course?: StudyCourse;
}

export interface Profile {
	profile_id: string;
	user_id: string;
	profile_role_id: string;
	profile_type_id: string;
	study_program_id: string | null;
	student_id?: number | null;
	email: string;
	full_name?: string | null;
	gender?: string | null;
	enrolment_year?: number | null;
	enrolment_intake?: number | null;
	profile_update_request?: any | null;
	created_at: string;
	created_by: string;
	modified_at?: string | null;
	modified_by?: string | null;
	deleted_at?: string | null;
	deleted_by?: string | null;
	current_year?: number;
	current_semester?: number;
	study_program?: StudyProgram;
	profile_role?: ProfileRole;
	profile_type?: ProfileType;
}

export interface ProfileRole {
	profile_role_id: string;
	name: string;
	description?: string | null;
}

export interface ProfileType {
	profile_type_id: string;
	name: string;
	description?: string | null;
}

export interface Permission {
	permission_id: string;
	name: string;
	description?: string;
}

export interface RolePermission {
	role_permission_id: string;
	profile_role_id: string;
	permission_id: string;
	profile_role?: ProfileRole;
	permission?: Permission;
}

export interface Organisation {
	organisation_id: string;
	name: string;
	description?: string | null;
	organisation_update_request?: any | null;
	created_at: string;
	created_by: string;
	modified_at?: string | null;
	modified_by?: string | null;
	deleted_at?: string | null;
	deleted_by?: string | null;
	member_count?: number;
}

export interface OrganisationRole {
	organisation_role_id: string;
	name: string;
	description?: string | null;
}

export interface OrganisationMember {
	organisation_member_id: string;
	profile_id: string;
	organisation_id: string;
	role_id: string;
	created_at: string;
	created_by: string;
	modified_at?: string | null;
	modified_by?: string | null;
	deleted_at?: string | null;
	deleted_by?: string | null;
	profile?: Profile;
	organisation?: Organisation;
	organisation_role?: OrganisationRole;
}

export interface EventState {
	event_state_id?: string;
	name: string;
	description?: string | null;
}

export interface EventMode {
	event_mode_id?: string;
	name: string;
	description?: string | null;
}

export interface Event {
	event_id: string;
	organisation_id: string;
	event_state_id: string;
	event_mode_id: string;
	name: string;
	description?: string | null;
	venue?: string | null;
	capacity?: number | null;
	note_to_registrants?: string | null;
	start_datetime?: string | null;
	end_datetime?: string | null;
	registration_opening_datetime?: string | null;
	registration_closing_datetime?: string | null;
	registration_url?: string | null;
	registration_secret_code?: string | null;
	feedback_url?: string | null;
	ems_url?: string | null;
	ems_number?: string | null;
	reviewed_by?: string | null;
	reviewed_at?: string | null;
	reviewer_notes?: string | null;
	event_update_request?: any | null;
	created_at: string;
	created_by: string;
	modified_at?: string | null;
	modified_by?: string | null;
	deleted_at?: string | null;
	deleted_by?: string | null;
	organisation?: Organisation;
	event_state?: EventState;
	event_mode?: EventMode;
	registrations?: Registration[];
	registration_count?: number;
}

export interface Registration {
	registration_id: string;
	event_id: string;
	profile_id: string;
	registration_status_id: string;
	attended: boolean;
	attendance_recorded_by?: string | null;
	attendance_recorded_at?: string | null;
	created_at: string;
	created_by: string;
	modified_at?: string | null;
	modified_by?: string | null;
	deleted_at?: string | null;
	deleted_by?: string | null;
	event?: Event;
	profile?: Profile;
}

// Helper types for API responses
export interface ApiResponse<T> {
	data: T | null;
	error: string | null;
}

export interface PaginatedResponse<T> {
	data: T[];
	count: number;
	error: string | null;
}
