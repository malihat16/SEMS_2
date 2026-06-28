export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	graphql_public: {
		Tables: {
			[_ in never]: never;
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			graphql: {
				Args: {
					extensions?: Json;
					operationName?: string;
					query?: string;
					variables?: Json;
				};
				Returns: Json;
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
	public: {
		Tables: {
			event: {
				Row: {
					capacity: number | null;
					created_at: string;
					created_by: string;
					deleted_at: string | null;
					deleted_by: string | null;
					description: string | null;
					ems_number: string | null;
					ems_url: string | null;
					end_datetime: string | null;
					event_id: string;
					event_mode_id: string;
					event_state_id: string;
					event_update_request: Json | null;
					feedback_url: string | null;
					modified_at: string | null;
					modified_by: string | null;
					name: string;
					note_to_registrants: string | null;
					organisation_id: string;
					registration_closing_datetime: string | null;
					registration_opening_datetime: string | null;
					registration_secret_code: string | null;
					registration_url: string | null;
					reviewed_at: string | null;
					reviewed_by: string | null;
					reviewer_notes: string | null;
					start_datetime: string | null;
					venue: string | null;
				};
				Insert: {
					capacity?: number | null;
					created_at?: string;
					created_by: string;
					deleted_at?: string | null;
					deleted_by?: string | null;
					description?: string | null;
					ems_number?: string | null;
					ems_url?: string | null;
					end_datetime?: string | null;
					event_id?: string;
					event_mode_id: string;
					event_state_id: string;
					event_update_request?: Json | null;
					feedback_url?: string | null;
					modified_at?: string | null;
					modified_by?: string | null;
					name: string;
					note_to_registrants?: string | null;
					organisation_id: string;
					registration_closing_datetime?: string | null;
					registration_opening_datetime?: string | null;
					registration_secret_code?: string | null;
					registration_url?: string | null;
					reviewed_at?: string | null;
					reviewed_by?: string | null;
					reviewer_notes?: string | null;
					start_datetime?: string | null;
					venue?: string | null;
				};
				Update: {
					capacity?: number | null;
					created_at?: string;
					created_by?: string;
					deleted_at?: string | null;
					deleted_by?: string | null;
					description?: string | null;
					ems_number?: string | null;
					ems_url?: string | null;
					end_datetime?: string | null;
					event_id?: string;
					event_mode_id?: string;
					event_state_id?: string;
					event_update_request?: Json | null;
					feedback_url?: string | null;
					modified_at?: string | null;
					modified_by?: string | null;
					name?: string;
					note_to_registrants?: string | null;
					organisation_id?: string;
					registration_closing_datetime?: string | null;
					registration_opening_datetime?: string | null;
					registration_secret_code?: string | null;
					registration_url?: string | null;
					reviewed_at?: string | null;
					reviewed_by?: string | null;
					reviewer_notes?: string | null;
					start_datetime?: string | null;
					venue?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'fk_event_event_mode_id';
						columns: ['event_mode_id'];
						isOneToOne: false;
						referencedRelation: 'event_mode';
						referencedColumns: ['event_mode_id'];
					},
					{
						foreignKeyName: 'fk_event_event_state_id';
						columns: ['event_state_id'];
						isOneToOne: false;
						referencedRelation: 'event_state';
						referencedColumns: ['event_state_id'];
					},
					{
						foreignKeyName: 'fk_event_organisation_id';
						columns: ['organisation_id'];
						isOneToOne: false;
						referencedRelation: 'organisation';
						referencedColumns: ['organisation_id'];
					}
				];
			};
			event_mode: {
				Row: {
					description: string | null;
					event_mode_id: string;
					name: string;
				};
				Insert: {
					description?: string | null;
					event_mode_id?: string;
					name: string;
				};
				Update: {
					description?: string | null;
					event_mode_id?: string;
					name?: string;
				};
				Relationships: [];
			};
			event_state: {
				Row: {
					description: string | null;
					event_state_id: string;
					name: string;
				};
				Insert: {
					description?: string | null;
					event_state_id?: string;
					name: string;
				};
				Update: {
					description?: string | null;
					event_state_id?: string;
					name?: string;
				};
				Relationships: [];
			};
			notification_log: {
				Row: {
					attempt_count: number | null;
					created_at: string;
					created_by: string;
					deleted_at: string | null;
					deleted_by: string | null;
					last_attempt_at: string | null;
					last_error: string | null;
					modified_at: string | null;
					modified_by: string | null;
					notification_log_id: string;
					notification_status_id: string;
					registration_id: string;
					template_name: string;
				};
				Insert: {
					attempt_count?: number | null;
					created_at?: string;
					created_by: string;
					deleted_at?: string | null;
					deleted_by?: string | null;
					last_attempt_at?: string | null;
					last_error?: string | null;
					modified_at?: string | null;
					modified_by?: string | null;
					notification_log_id?: string;
					notification_status_id: string;
					registration_id: string;
					template_name: string;
				};
				Update: {
					attempt_count?: number | null;
					created_at?: string;
					created_by?: string;
					deleted_at?: string | null;
					deleted_by?: string | null;
					last_attempt_at?: string | null;
					last_error?: string | null;
					modified_at?: string | null;
					modified_by?: string | null;
					notification_log_id?: string;
					notification_status_id?: string;
					registration_id?: string;
					template_name?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'fk_notification_log_notification_status_id';
						columns: ['notification_status_id'];
						isOneToOne: false;
						referencedRelation: 'notification_status';
						referencedColumns: ['notification_status_id'];
					},
					{
						foreignKeyName: 'fk_notification_log_registration_id';
						columns: ['registration_id'];
						isOneToOne: false;
						referencedRelation: 'registration';
						referencedColumns: ['registration_id'];
					}
				];
			};
			notification_status: {
				Row: {
					description: string | null;
					name: string;
					notification_status_id: string;
				};
				Insert: {
					description?: string | null;
					name: string;
					notification_status_id?: string;
				};
				Update: {
					description?: string | null;
					name?: string;
					notification_status_id?: string;
				};
				Relationships: [];
			};
			organisation: {
				Row: {
					created_at: string;
					created_by: string;
					deleted_at: string | null;
					deleted_by: string | null;
					description: string | null;
					modified_at: string | null;
					modified_by: string | null;
					name: string;
					organisation_id: string;
					organisation_update_request: Json | null;
				};
				Insert: {
					created_at?: string;
					created_by: string;
					deleted_at?: string | null;
					deleted_by?: string | null;
					description?: string | null;
					modified_at?: string | null;
					modified_by?: string | null;
					name: string;
					organisation_id?: string;
					organisation_update_request?: Json | null;
				};
				Update: {
					created_at?: string;
					created_by?: string;
					deleted_at?: string | null;
					deleted_by?: string | null;
					description?: string | null;
					modified_at?: string | null;
					modified_by?: string | null;
					name?: string;
					organisation_id?: string;
					organisation_update_request?: Json | null;
				};
				Relationships: [];
			};
			organisation_member: {
				Row: {
					created_at: string;
					created_by: string;
					deleted_at: string | null;
					deleted_by: string | null;
					modified_at: string | null;
					modified_by: string | null;
					organisation_id: string;
					organisation_member_id: string;
					profile_id: string;
					role_id: string;
				};
				Insert: {
					created_at?: string;
					created_by: string;
					deleted_at?: string | null;
					deleted_by?: string | null;
					modified_at?: string | null;
					modified_by?: string | null;
					organisation_id: string;
					organisation_member_id?: string;
					profile_id: string;
					role_id: string;
				};
				Update: {
					created_at?: string;
					created_by?: string;
					deleted_at?: string | null;
					deleted_by?: string | null;
					modified_at?: string | null;
					modified_by?: string | null;
					organisation_id?: string;
					organisation_member_id?: string;
					profile_id?: string;
					role_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'fk_organisation_member_organisation_id';
						columns: ['organisation_id'];
						isOneToOne: false;
						referencedRelation: 'organisation';
						referencedColumns: ['organisation_id'];
					},
					{
						foreignKeyName: 'fk_organisation_member_profile_id';
						columns: ['profile_id'];
						isOneToOne: false;
						referencedRelation: 'profile';
						referencedColumns: ['profile_id'];
					},
					{
						foreignKeyName: 'fk_organisation_member_role_id';
						columns: ['role_id'];
						isOneToOne: false;
						referencedRelation: 'organisation_role';
						referencedColumns: ['organisation_role_id'];
					}
				];
			};
			organisation_role: {
				Row: {
					description: string | null;
					name: string;
					organisation_role_id: string;
				};
				Insert: {
					description?: string | null;
					name: string;
					organisation_role_id?: string;
				};
				Update: {
					description?: string | null;
					name?: string;
					organisation_role_id?: string;
				};
				Relationships: [];
			};
			profile: {
				Row: {
					created_at: string;
					created_by: string;
					deleted_at: string | null;
					deleted_by: string | null;
					email: string;
					enrolment_intake: number | null;
					enrolment_year: number | null;
					full_name: string | null;
					gender: string | null;
					modified_at: string | null;
					modified_by: string | null;
					profile_id: string;
					profile_role_id: string;
					profile_type_id: string;
					profile_update_request: Json | null;
					student_id: number | null;
					study_program_id: string | null;
					user_id: string;
				};
				Insert: {
					created_at?: string;
					created_by: string;
					deleted_at?: string | null;
					deleted_by?: string | null;
					email: string;
					enrolment_intake?: number | null;
					enrolment_year?: number | null;
					full_name?: string | null;
					gender?: string | null;
					modified_at?: string | null;
					modified_by?: string | null;
					profile_id?: string;
					profile_role_id: string;
					profile_type_id: string;
					profile_update_request?: Json | null;
					student_id?: number | null;
					study_program_id?: string | null;
					user_id: string;
				};
				Update: {
					created_at?: string;
					created_by?: string;
					deleted_at?: string | null;
					deleted_by?: string | null;
					email?: string;
					enrolment_intake?: number | null;
					enrolment_year?: number | null;
					full_name?: string | null;
					gender?: string | null;
					modified_at?: string | null;
					modified_by?: string | null;
					profile_id?: string;
					profile_role_id?: string;
					profile_type_id?: string;
					profile_update_request?: Json | null;
					student_id?: number | null;
					study_program_id?: string | null;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'fk_profile_profile_role_id';
						columns: ['profile_role_id'];
						isOneToOne: false;
						referencedRelation: 'profile_role';
						referencedColumns: ['profile_role_id'];
					},
					{
						foreignKeyName: 'fk_profile_profile_type_id';
						columns: ['profile_type_id'];
						isOneToOne: false;
						referencedRelation: 'profile_type';
						referencedColumns: ['profile_type_id'];
					},
					{
						foreignKeyName: 'fk_profile_study_program_id';
						columns: ['study_program_id'];
						isOneToOne: false;
						referencedRelation: 'study_program';
						referencedColumns: ['study_program_id'];
					}
				];
			};
			profile_role: {
				Row: {
					description: string | null;
					name: string;
					profile_role_id: string;
				};
				Insert: {
					description?: string | null;
					name: string;
					profile_role_id?: string;
				};
				Update: {
					description?: string | null;
					name?: string;
					profile_role_id?: string;
				};
				Relationships: [];
			};
			profile_type: {
				Row: {
					description: string | null;
					name: string;
					profile_type_id: string;
				};
				Insert: {
					description?: string | null;
					name: string;
					profile_type_id?: string;
				};
				Update: {
					description?: string | null;
					name?: string;
					profile_type_id?: string;
				};
				Relationships: [];
			};
			registration: {
				Row: {
					attendance_recorded_at: string | null;
					attendance_recorded_by: string | null;
					attended: boolean;
					created_at: string;
					created_by: string;
					deleted_at: string | null;
					deleted_by: string | null;
					event_id: string;
					modified_at: string | null;
					modified_by: string | null;
					profile_id: string;
					registration_id: string;
					registration_status_id: string;
				};
				Insert: {
					attendance_recorded_at?: string | null;
					attendance_recorded_by?: string | null;
					attended?: boolean;
					created_at?: string;
					created_by: string;
					deleted_at?: string | null;
					deleted_by?: string | null;
					event_id: string;
					modified_at?: string | null;
					modified_by?: string | null;
					profile_id: string;
					registration_id?: string;
					registration_status_id: string;
				};
				Update: {
					attendance_recorded_at?: string | null;
					attendance_recorded_by?: string | null;
					attended?: boolean;
					created_at?: string;
					created_by?: string;
					deleted_at?: string | null;
					deleted_by?: string | null;
					event_id?: string;
					modified_at?: string | null;
					modified_by?: string | null;
					profile_id?: string;
					registration_id?: string;
					registration_status_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'fk_registration_event_id';
						columns: ['event_id'];
						isOneToOne: false;
						referencedRelation: 'event';
						referencedColumns: ['event_id'];
					},
					{
						foreignKeyName: 'fk_registration_profile_id';
						columns: ['profile_id'];
						isOneToOne: false;
						referencedRelation: 'profile';
						referencedColumns: ['profile_id'];
					},
					{
						foreignKeyName: 'fk_registration_registration_status_id';
						columns: ['registration_status_id'];
						isOneToOne: false;
						referencedRelation: 'registration_status';
						referencedColumns: ['registration_status_id'];
					}
				];
			};
			registration_status: {
				Row: {
					description: string | null;
					name: string;
					registration_status_id: string;
				};
				Insert: {
					description?: string | null;
					name: string;
					registration_status_id?: string;
				};
				Update: {
					description?: string | null;
					name?: string;
					registration_status_id?: string;
				};
				Relationships: [];
			};
			study_course: {
				Row: {
					description: string | null;
					name: string;
					study_course_id: string;
				};
				Insert: {
					description?: string | null;
					name: string;
					study_course_id?: string;
				};
				Update: {
					description?: string | null;
					name?: string;
					study_course_id?: string;
				};
				Relationships: [];
			};
			study_level: {
				Row: {
					description: string | null;
					name: string;
					study_level_id: string;
				};
				Insert: {
					description?: string | null;
					name: string;
					study_level_id?: string;
				};
				Update: {
					description?: string | null;
					name?: string;
					study_level_id?: string;
				};
				Relationships: [];
			};
			study_program: {
				Row: {
					description: string | null;
					study_course_id: string;
					study_level_id: string;
					study_program_id: string;
					study_school_id: string;
				};
				Insert: {
					description?: string | null;
					study_course_id: string;
					study_level_id: string;
					study_program_id?: string;
					study_school_id: string;
				};
				Update: {
					description?: string | null;
					study_course_id?: string;
					study_level_id?: string;
					study_program_id?: string;
					study_school_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'fk_study_program_study_course_id';
						columns: ['study_course_id'];
						isOneToOne: false;
						referencedRelation: 'study_course';
						referencedColumns: ['study_course_id'];
					},
					{
						foreignKeyName: 'fk_study_program_study_level_id';
						columns: ['study_level_id'];
						isOneToOne: false;
						referencedRelation: 'study_level';
						referencedColumns: ['study_level_id'];
					},
					{
						foreignKeyName: 'fk_study_program_study_school_id';
						columns: ['study_school_id'];
						isOneToOne: false;
						referencedRelation: 'study_school';
						referencedColumns: ['study_school_id'];
					}
				];
			};
			study_school: {
				Row: {
					description: string | null;
					name: string;
					study_school_id: string;
				};
				Insert: {
					description?: string | null;
					name: string;
					study_school_id?: string;
				};
				Update: {
					description?: string | null;
					name?: string;
					study_school_id?: string;
				};
				Relationships: [];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			get_current_profile: { Args: never; Returns: string };
			has_profile_role: { Args: { required_role: string }; Returns: boolean };
			is_organisation_member: {
				Args: { min_role?: string; org_id: string };
				Returns: boolean;
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
		: never = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema['Tables']
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema['Tables']
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		| keyof DefaultSchema['Enums']
		| { schema: keyof DatabaseWithoutInternals },
	EnumName extends DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
		: never = never
> = DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
		? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		| keyof DefaultSchema['CompositeTypes']
		| { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
		: never = never
> = PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
		? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
		: never;

export const Constants = {
	graphql_public: {
		Enums: {}
	},
	public: {
		Enums: {}
	}
} as const;
