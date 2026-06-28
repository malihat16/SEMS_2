import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import {
	EVENT_STATES,
	EVENT_MODES,
	PROFILE_ROLES,
	ORGANISATION_ROLES,
	REGISTRATION_STATUSES
} from './constants';
import type {
	Event,
	Profile,
	ProfileRole,
	ProfileType,
	Registration,
	Organisation,
	OrganisationMember,
	OrganisationRole
} from './types';

// Profile Services
export async function getUserProfile(
	supabase: SupabaseClient<Database>,
	userId: string
): Promise<Profile | null> {
	try {
		const { data, error } = await supabase
			.from('profile')
			.select(
				`
        *,
        profile_role:profile_role_id(profile_role_id, name, description),
        profile_type:profile_type_id(profile_type_id, name, description),
        study_program:study_program_id(
          *,
          study_level:study_level_id(name, description),
          study_school:study_school_id(name, description),
          study_course:study_course_id(name, description)
        )
      `
			)
			.eq('user_id', userId)
			.is('deleted_at', null)
			.maybeSingle();

		if (error) {
			console.error('Error fetching user profile:', error);
			return null;
		}

		return data as Profile | null;
	} catch (error) {
		console.error('Error in getUserProfile:', error);
		return null;
	}
}

export async function createUserProfile(
	supabase: SupabaseClient<Database>,
	profile: Partial<Profile>
): Promise<Profile | null> {
	try {
		const { data, error } = await supabase
			.from('profile')
			.insert(profile as any)
			.select()
			.single();

		if (error) {
			console.error('Error creating user profile:', error);
			return null;
		}

		return data as Profile;
	} catch (error) {
		console.error('Error in createUserProfile:', error);
		return null;
	}
}

export async function updateUserProfile(
	supabase: SupabaseClient<Database>,
	profileId: string,
	updates: Partial<Profile>
): Promise<Profile | null> {
	try {
		const { data, error } = await supabase
			.from('profile')
			.update({
				...updates,
				modified_at: new Date().toISOString()
			})
			.eq('profile_id', profileId)
			.select()
			.single();

		if (error) {
			console.error('Error updating user profile:', error);
			return null;
		}

		return data as Profile;
	} catch (error) {
		console.error('Error in updateUserProfile:', error);
		return null;
	}
}

export async function requestProfileUpdate(
	supabase: SupabaseClient<Database>,
	profileId: string,
	updateRequest: any
): Promise<Profile | null> {
	try {
		const { data, error } = await supabase
			.from('profile')
			.update({
				profile_update_request: updateRequest,
				modified_at: new Date().toISOString()
			})
			.eq('profile_id', profileId)
			.select()
			.single();

		if (error) {
			console.error('Error requesting profile update:', error);
			return null;
		}

		return data as Profile;
	} catch (error) {
		console.error('Error in requestProfileUpdate:', error);
		return null;
	}
}

export async function clearProfileUpdateRequest(
	supabase: SupabaseClient<Database>,
	profileId: string
): Promise<Profile | null> {
	try {
		const { data, error } = await supabase
			.from('profile')
			.update({
				profile_update_request: null,
				modified_at: new Date().toISOString()
			})
			.eq('profile_id', profileId)
			.select()
			.single();

		if (error) {
			console.error('Error clearing profile update request:', error);
			return null;
		}

		return data as Profile;
	} catch (error) {
		console.error('Error in clearProfileUpdateRequest:', error);
		return null;
	}
}

export async function getEvents(
	supabase: SupabaseClient<Database>,
	filters?: {
		organisation_id?: string;
		event_state?: string;
		limit?: number;
		offset?: number;
		registerable?: boolean;
	}
): Promise<{ events: Event[]; count: number }> {
	try {
		let query = supabase
			.from('event')
			.select(
				`
        *,
        organisation:organisation_id(name, description),
        event_state:event_state_id(name, description),
        event_mode:event_mode_id(name, description),
        registrations:registration(registration_id, deleted_at)
      `,
				{ count: 'exact' }
			)
			.is('deleted_at', null);

		if (filters?.organisation_id) {
			query = query.eq('organisation_id', filters.organisation_id);
		}

		// If event_state filter is provided, we need to filter by the event_state_id using a subquery
		if (filters?.event_state) {
			// First get the event_state_id for the given state name
			const { data: eventStateData, error: eventStateError } = await supabase
				.from('event_state')
				.select('event_state_id')
				.eq('name', filters.event_state)
				.single();

			if (eventStateError) {
				console.error('Error fetching event state:', eventStateError);
				return { events: [], count: 0 };
			}

			if (eventStateData) {
				query = query.eq('event_state_id', eventStateData.event_state_id);
			} else {
				// If no matching event state found, return empty results
				return { events: [], count: 0 };
			}
		}

		if (filters?.registerable) {
			const now = new Date().toISOString();
			query = query.gt('registration_closing_datetime', now);
		}

		if (filters?.limit) {
			query = query.limit(filters.limit);
		}

		if (filters?.offset) {
			query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
		}

		const { data, error, count } = await query.order('start_datetime', { ascending: true });

		if (error) {
			console.error('Error fetching events:', error);
			return { events: [], count: 0 };
		}

		const now = new Date();
		const eventsWithCount = (data || []).map((event) => ({
			...event,
			registration_count: event.registrations?.filter((reg: any) => !reg.deleted_at)?.length || 0,
			registerable: event.registration_closing_datetime
				? new Date(event.registration_closing_datetime) > now
				: false
		})) as unknown as Event[];

		return { events: eventsWithCount, count: count || 0 };
	} catch (error) {
		console.error('Error in getEvents:', error);
		return { events: [], count: 0 };
	}
}

export async function getEventById(
	supabase: SupabaseClient<Database>,
	eventId: string
): Promise<Event | null> {
	try {
		const { data, error } = await supabase
			.from('event')
			.select(
				`
        *,
        organisation:organisation_id(name, description),
        event_state:event_state_id(name, description),
        event_mode:event_mode_id(name, description),
        registrations:registration(
          registration_id,
          deleted_at,
          profile:profile_id(full_name, student_id)
        )
      `
			)
			.eq('event_id', eventId)
			.is('deleted_at', null)
			.single();

		if (error) {
			console.error('Error fetching event:', error);
			return null;
		}

		return {
			...data,
			registration_count: data.registrations?.filter((reg: any) => !reg.deleted_at)?.length || 0
		} as Event;
	} catch (error) {
		console.error('Error in getEventById:', error);
		return null;
	}
}

export async function createEvent(
	supabase: SupabaseClient<Database>,
	event: Partial<Event>
): Promise<Event | null> {
	try {
		const { data, error } = await supabase
			.from('event')
			.insert(event as any)
			.select()
			.single();

		if (error) {
			console.error('Error creating event:', error);
			return null;
		}

		return data as Event;
	} catch (error) {
		console.error('Error in createEvent:', error);
		return null;
	}
}

export async function saveDraftEvent(
	supabase: SupabaseClient<Database>,
	event: Partial<Event>
): Promise<Event | null> {
	try {
		const { data, error } = await supabase
			.from('event')
			.insert(event as any)
			.select()
			.single();

		if (error) {
			console.error('Error saving draft event:', error);
			return null;
		}

		return data as Event;
	} catch (error) {
		console.error('Error in saveDraftEvent:', error);
		return null;
	}
}

// Registration Services
export async function registerForEvent(
	supabase: SupabaseClient<Database>,
	eventId: string,
	profileId: string
): Promise<{ success: boolean; registration?: Registration; error?: string }> {
	try {
		// Get current authenticated user
		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser();
		if (authError || !user) {
			console.error('Authentication error:', authError);
			return { success: false, error: 'authentication_required' };
		}
		// Check if already registered
		const { data: existingRegistration } = await supabase
			.from('registration')
			.select('registration_id')
			.eq('event_id', eventId)
			.eq('profile_id', profileId)
			.is('deleted_at', null)
			.maybeSingle();

		if (existingRegistration) {
			console.log('User already registered for this event');
			return { success: false, error: 'already_registered' };
		}

		// Get event details and current registration count
		const { data: eventData, error: eventError } = await supabase
			.from('event')
			.select(
				`
				capacity,
				registrations:registration(registration_id, deleted_at)
			`
			)
			.eq('event_id', eventId)
			.single();

		if (eventError) {
			console.error('Error fetching event data:', eventError);
			return { success: false, error: 'event_not_found' };
		}

		// Check capacity if event has a capacity limit
		if (eventData?.capacity !== null && eventData?.capacity !== undefined) {
			const currentRegistrationCount =
				eventData.registrations?.filter((reg: any) => !reg.deleted_at)?.length || 0;

			if (currentRegistrationCount >= eventData.capacity) {
				console.log('Event is at full capacity');
				return { success: false, error: 'event_full' };
			}
		}

		// Get the CONFIRMED registration status ID
		const { data: statusData, error: statusError } = await supabase
			.from('registration_status')
			.select('registration_status_id')
			.eq('name', REGISTRATION_STATUSES.CONFIRMED)
			.single();

		if (statusError) {
			console.error('Error fetching registration status:', statusError);
			return { success: false, error: 'status_not_found' };
		}

		// Create new registration
		const { data, error } = await supabase
			.from('registration')
			.insert({
				event_id: eventId,
				profile_id: profileId,
				registration_status_id: statusData.registration_status_id,
				created_at: new Date().toISOString(),
				created_by: user.id
			})
			.select()
			.single();

		if (error) {
			console.error('Error registering for event:', error);
			return { success: false, error: 'registration_failed' };
		}

		return { success: true, registration: data as Registration };
	} catch (error) {
		console.error('Error in registerForEvent:', error);
		return { success: false, error: 'unexpected_error' };
	}
}

export async function unregisterFromEvent(
	supabase: SupabaseClient<Database>,
	eventId: string,
	profileId: string
): Promise<boolean> {
	try {
		const { error } = await supabase
			.from('registration')
			.update({ deleted_at: new Date().toISOString() })
			.eq('event_id', eventId)
			.eq('profile_id', profileId)
			.is('deleted_at', null);

		if (error) {
			console.error('Error unregistering from event:', error);
			return false;
		}

		return true;
	} catch (error) {
		console.error('Error in unregisterFromEvent:', error);
		return false;
	}
}

export async function getUserRegistrations(
	supabase: SupabaseClient<Database>,
	profileId: string
): Promise<Registration[]> {
	try {
		const { data, error } = await supabase
			.from('registration')
			.select(
				`
        *,
        event:event_id(
          *,
          organisation:organisation_id(name, description),
          event_state:event_state_id(name, description),
          event_mode:event_mode_id(name, description),
          registrations:registration(registration_id, deleted_at)
        )
      `
			)
			.eq('profile_id', profileId)
			.is('deleted_at', null)
			.order('created_at', { ascending: false });

		if (error) {
			console.error('Error fetching user registrations:', error);
			return [];
		}

		// Add registration count to each event
		const registrationsWithCounts = (data || []).map((registration) => {
			let processedRegistration = { ...registration };

			// Process event data
			if (registration.event) {
				const registrationCount =
					registration.event.registrations?.filter((reg: any) => !reg.deleted_at)?.length || 0;
				processedRegistration = {
					...processedRegistration,
					event: {
						...registration.event,
						registration_count: registrationCount
					} as any
				};
			}
			return processedRegistration;
		});

		return registrationsWithCounts as unknown as Registration[];
	} catch (error) {
		console.error('Error in getUserRegistrations:', error);
		return [];
	}
}

// Organisation Services
export async function getOrganisations(
	supabase: SupabaseClient<Database>
): Promise<Organisation[]> {
	try {
		console.log('Fetching organisations...');

		// Get organisations first
		const { data: organisations, error: orgError } = await supabase
			.from('organisation')
			.select('*')
			.is('deleted_at', null)
			.order('name');

		if (orgError) {
			console.error('Error fetching organisations:', orgError);
			return [];
		}

		if (!organisations || organisations.length === 0) {
			console.log('No organisations found');
			return [];
		}

		// Get member counts for each organisation
		const organisationsWithCount = await Promise.all(
			organisations.map(async (org) => {
				const { count, error: countError } = await supabase
					.from('organisation_member')
					.select('*', { count: 'exact', head: true })
					.eq('organisation_id', org.organisation_id)
					.is('deleted_at', null);

				if (countError) {
					console.error(`Error counting members for org ${org.organisation_id}:`, countError);
					return { ...org, member_count: 0 };
				}

				return { ...org, member_count: count || 0 };
			})
		);

		console.log('Returning organisations with member count:', organisationsWithCount);
		return organisationsWithCount as Organisation[];
	} catch (error) {
		console.error('Error in getOrganisations:', error);
		return [];
	}
}

export async function createOrganisation(
	supabase: SupabaseClient<Database>,
	organisation: Omit<
		Organisation,
		| 'organisation_id'
		| 'created_at'
		| 'created_by'
		| 'modified_at'
		| 'modified_by'
		| 'deleted_at'
		| 'deleted_by'
	>,
	createdBy: string
): Promise<Organisation | null> {
	try {
		console.log('Creating organisation:', organisation, 'by user:', createdBy);

		const insertData = {
			name: organisation.name,
			description: organisation.description,
			created_at: new Date().toISOString(),
			created_by: createdBy
		};

		console.log('Insert data:', insertData);

		const { data, error } = await supabase
			.from('organisation')
			.insert(insertData)
			.select()
			.single();

		console.log('Supabase response:', { data, error });

		if (error) {
			console.error('Error creating organisation:', error);
			return null;
		}

		return data as Organisation;
	} catch (error) {
		console.error('Error in createOrganisation:', error);
		return null;
	}
}

export async function updateOrganisation(
	supabase: SupabaseClient<Database>,
	organisationId: string,
	updates: Partial<Organisation>,
	modifiedBy: string
): Promise<Organisation | null> {
	try {
		const { data, error } = await supabase
			.from('organisation')
			.update({
				...updates,
				modified_at: new Date().toISOString(),
				modified_by: modifiedBy
			})
			.eq('organisation_id', organisationId)
			.select()
			.single();

		if (error) {
			console.error('Error updating organisation:', error);
			return null;
		}

		return data;
	} catch (error) {
		console.error('Error in updateOrganisation:', error);
		return null;
	}
}

export async function requestOrganisationUpdate(
	supabase: SupabaseClient<Database>,
	organisationId: string,
	updateRequest: any
): Promise<Organisation | null> {
	try {
		const { data, error } = await supabase
			.from('organisation')
			.update({
				organisation_update_request: updateRequest,
				modified_at: new Date().toISOString()
			})
			.eq('organisation_id', organisationId)
			.select()
			.single();

		if (error) {
			console.error('Error requesting organisation update:', error);
			return null;
		}

		return data;
	} catch (error) {
		console.error('Error in requestOrganisationUpdate:', error);
		return null;
	}
}

export async function clearOrganisationUpdateRequest(
	supabase: SupabaseClient<Database>,
	organisationId: string
): Promise<Organisation | null> {
	try {
		const { data, error } = await supabase
			.from('organisation')
			.update({
				organisation_update_request: null,
				modified_at: new Date().toISOString()
			})
			.eq('organisation_id', organisationId)
			.select()
			.single();

		if (error) {
			console.error('Error clearing organisation update request:', error);
			return null;
		}

		return data;
	} catch (error) {
		console.error('Error in clearOrganisationUpdateRequest:', error);
		return null;
	}
}

export async function deleteOrganisation(
	supabase: SupabaseClient<Database>,
	organisationId: string,
	deletedBy: string
): Promise<boolean> {
	try {
		const { error } = await supabase
			.from('organisation')
			.update({
				deleted_at: new Date().toISOString(),
				deleted_by: deletedBy
			})
			.eq('organisation_id', organisationId);

		if (error) {
			console.error('Error deleting organisation:', error);
			return false;
		}

		return true;
	} catch (error) {
		console.error('Error in deleteOrganisation:', error);
		return false;
	}
}

// Organisation Roles Services
export async function getOrganisationRoles(
	supabase: SupabaseClient<Database>
): Promise<OrganisationRole[]> {
	try {
		const { data, error } = await supabase.from('organisation_role').select('*');

		if (error) {
			console.error('Error fetching organisation roles:', error);
			return [];
		}

		return data || [];
	} catch (error) {
		console.error('Error in getOrganisationRoles:', error);
		return [];
	}
}

// Organisation Members Services
export async function getOrganisationMembers(
	supabase: SupabaseClient<Database>,
	organisationId: string
): Promise<OrganisationMember[]> {
	try {
		const { data, error } = await supabase
			.from('organisation_member')
			.select(
				`
				*,
				profile:profile_id(
					profile_id,
					full_name,
					email,
					student_id,
					study_program:study_program_id(
						study_level:study_level_id(name),
						study_school:study_school_id(name),
						study_course:study_course_id(name)
					)
				),
				organisation_role:role_id(name, description)
			`
			)
			.eq('organisation_id', organisationId)
			.is('deleted_at', null)
			.order('created_at');

		if (error) {
			console.error('Error fetching organisation members:', error);
			return [];
		}

		return (data || []) as unknown as OrganisationMember[];
	} catch (error) {
		console.error('Error in getOrganisationMembers:', error);
		return [];
	}
}

export async function addOrganisationMember(
	supabase: SupabaseClient<Database>,
	organisationId: string,
	profileId: string,
	roleId: string,
	createdBy: string
): Promise<OrganisationMember | null> {
	try {
		// Check if member already exists
		const { data: existing } = await supabase
			.from('organisation_member')
			.select('organisation_member_id')
			.eq('organisation_id', organisationId)
			.eq('profile_id', profileId)
			.is('deleted_at', null)
			.maybeSingle();

		if (existing) {
			throw new Error('User is already a member of this organisation');
		}

		const { data, error } = await supabase
			.from('organisation_member')
			.insert({
				organisation_id: organisationId,
				profile_id: profileId,
				role_id: roleId,
				created_at: new Date().toISOString(),
				created_by: createdBy
			})
			.select(
				`
				*,
				profile:profile_id(
					profile_id,
					full_name,
					student_id,
					study_program:study_program_id(
						study_level:study_level_id(name),
						study_school:study_school_id(name),
						study_course:study_course_id(name)
					)
				),
				organisation_role:role_id(name, description)
			`
			)
			.single();

		if (error) {
			console.error('Error adding organisation member:', error);
			return null;
		}

		return data as unknown as OrganisationMember;
	} catch (error) {
		console.error('Error in addOrganisationMember:', error);
		return null;
	}
}

export async function updateOrganisationMemberRole(
	supabase: SupabaseClient<Database>,
	memberId: string,
	roleId: string,
	modifiedBy: string
): Promise<OrganisationMember | null> {
	try {
		const { data, error } = await supabase
			.from('organisation_member')
			.update({
				role_id: roleId,
				modified_at: new Date().toISOString(),
				modified_by: modifiedBy
			})
			.eq('organisation_member_id', memberId)
			.select(
				`
				*,
				profile:profile_id(
					profile_id,
					full_name,
					student_id,
					study_program:study_program_id(
						study_level:study_level_id(name),
						study_school:study_school_id(name),
						study_course:study_course_id(name)
					)
				),
				organisation_role:role_id(name, description)
			`
			)
			.single();

		if (error) {
			console.error('Error updating organisation member role:', error);
			return null;
		}

		return data as unknown as OrganisationMember;
	} catch (error) {
		console.error('Error in updateOrganisationMemberRole:', error);
		return null;
	}
}

export async function removeOrganisationMember(
	supabase: SupabaseClient<Database>,
	memberId: string,
	deletedBy: string
): Promise<boolean> {
	try {
		const { error } = await supabase
			.from('organisation_member')
			.update({
				deleted_at: new Date().toISOString(),
				deleted_by: deletedBy
			})
			.eq('organisation_member_id', memberId);

		if (error) {
			console.error('Error removing organisation member:', error);
			return false;
		}

		return true;
	} catch (error) {
		console.error('Error in removeOrganisationMember:', error);
		return false;
	}
}

// Search for users to add to organisation
export async function searchUsers(
	supabase: SupabaseClient<Database>,
	searchTerm: string
): Promise<any[]> {
	try {
		console.log('searchUsers called with term:', searchTerm);

		// First, let's test a simple query to see if there are any profiles at all
		const { data: allProfiles, error: testError } = await supabase
			.from('profile')
			.select('profile_id, full_name, student_id')
			.is('deleted_at', null)
			.limit(5);

		console.log('Test query - all profiles:', { data: allProfiles, error: testError });

		// Search by name first
		const { data: nameResults, error: nameError } = await supabase
			.from('profile')
			.select(
				`
				profile_id,
				user_id,
				full_name,
				email,
				student_id,
				study_program:study_program_id(
					study_level:study_level_id(name),
					study_school:study_school_id(name),
					study_course:study_course_id(name)
				)
			`
			)
			.ilike('full_name', `%${searchTerm}%`)
			.is('deleted_at', null)
			.limit(10);

		console.log('Name search result:', { data: nameResults, error: nameError });

		// If search term is numeric, also search by student_id
		const isNumeric = /^\d+$/.test(searchTerm);
		let studentIdResults: any[] = [];

		if (isNumeric) {
			const { data: idResults, error: idError } = await supabase
				.from('profile')
				.select(
					`
					profile_id,
					user_id,
					full_name,
					email,
					student_id,
					study_program:study_program_id(
						study_level:study_level_id(name),
						study_school:study_school_id(name),
						study_course:study_course_id(name)
					)
				`
				)
				.eq('student_id', parseInt(searchTerm))
				.is('deleted_at', null)
				.limit(10);

			console.log('Student ID search result:', { data: idResults, error: idError });

			if (!idError && idResults) {
				studentIdResults = idResults;
			}
		}

		// Combine and deduplicate results
		const allResults = [...(nameResults || []), ...studentIdResults];
		const uniqueResults = allResults.filter(
			(result, index, self) => index === self.findIndex((r) => r.profile_id === result.profile_id)
		);

		console.log('Combined search results:', uniqueResults);

		return uniqueResults;
	} catch (error) {
		console.error('Error in searchUsers:', error);
		return [];
	}
}

// Reference Data Services
export async function getStudyLevels(supabase: SupabaseClient<Database>) {
	try {
		const { data, error } = await supabase.from('study_level').select('*');

		if (error) {
			console.error('Error fetching study levels:', error);
			return [];
		}

		return data || [];
	} catch (error) {
		console.error('Error in getStudyLevels:', error);
		return [];
	}
}

export async function getStudySchools(supabase: SupabaseClient<Database>) {
	try {
		const { data, error } = await supabase.from('study_school').select('*').order('name');

		if (error) {
			console.error('Error fetching study schools:', error);
			return [];
		}

		return data || [];
	} catch (error) {
		console.error('Error in getStudySchools:', error);
		return [];
	}
}

export async function getStudyCourses(supabase: SupabaseClient<Database>) {
	try {
		const { data, error } = await supabase.from('study_course').select('*').order('name');

		if (error) {
			console.error('Error fetching study courses:', error);
			return [];
		}

		return data || [];
	} catch (error) {
		console.error('Error in getStudyCourses:', error);
		return [];
	}
}

export async function getStudyProgram(
	supabase: SupabaseClient<Database>,
	studyLevelId: string,
	studySchoolId: string,
	studyCourseId: string
): Promise<string | null> {
	try {
		const { data: existing, error: findError } = await supabase
			.from('study_program')
			.select('study_program_id')
			.eq('study_level_id', studyLevelId)
			.eq('study_school_id', studySchoolId)
			.eq('study_course_id', studyCourseId)
			.single();

		if (findError) {
			console.error('Error finding study program:', findError);
			return null;
		}

		return existing?.study_program_id || null;
	} catch (error) {
		console.error('Error in getStudyProgram:', error);
		return null;
	}
}

export async function getStudyProgramsBySchoolAndLevel(
	supabase: SupabaseClient<Database>,
	studyLevelId: string,
	studySchoolId: string
) {
	try {
		const { data, error } = await supabase
			.from('study_program')
			.select(
				`
				study_program_id,
				description,
				study_course:study_course_id (
					study_course_id,
					name,
					description
				)
			`
			)
			.eq('study_level_id', studyLevelId)
			.eq('study_school_id', studySchoolId)
			.order('study_course(name)');

		if (error) {
			console.error('Error fetching study programs by school and level:', error);
			return [];
		}

		// Extract the course data from the nested structure
		return (
			data?.map((item) => ({
				study_program_id: item.study_program_id,
				description: item.description,
				study_course: item.study_course
			})) || []
		);
	} catch (error) {
		console.error('Error in getStudyProgramsBySchoolAndLevel:', error);
		return [];
	}
}

export async function getProfileRoles(supabase: SupabaseClient<Database>) {
	try {
		const { data, error } = await supabase.from('profile_role').select('*').order('name');

		if (error) {
			console.error('Error fetching profile roles:', error);
			return [];
		}

		return data || [];
	} catch (error) {
		console.error('Error in getProfileRoles:', error);
		return [];
	}
}

export async function getProfileRoleByName(
	supabase: SupabaseClient<Database>,
	name: string
): Promise<ProfileRole | null> {
	try {
		const { data, error } = await supabase
			.from('profile_role')
			.select('*')
			.eq('name', name)
			.single();

		if (error) {
			console.error(`Error fetching profile role "${name}":`, error);
			return null;
		}

		return data as ProfileRole;
	} catch (error) {
		console.error(`Error in getProfileRoleByName("${name}"):`, error);
		return null;
	}
}

export async function getProfileTypeByName(
	supabase: SupabaseClient<Database>,
	name: string
): Promise<ProfileType | null> {
	try {
		const { data, error } = await supabase
			.from('profile_type')
			.select('*')
			.eq('name', name)
			.single();

		if (error) {
			console.error(`Error fetching profile type "${name}":`, error);
			return null;
		}

		return data as ProfileType;
	} catch (error) {
		console.error(`Error in getProfileTypeByName("${name}"):`, error);
		return null;
	}
}

export async function getEventStates(supabase: SupabaseClient<Database>) {
	try {
		const { data, error } = await supabase.from('event_state').select('*');

		if (error) {
			console.error('Error fetching event states:', error);
			return [];
		}

		return data || [];
	} catch (error) {
		console.error('Error in getEventStates:', error);
		return [];
	}
}

export async function getEventModes(supabase: SupabaseClient<Database>) {
	try {
		const { data, error } = await supabase.from('event_mode').select('*');

		if (error) {
			console.error('Error fetching event modes:', error);
			return [];
		}

		return data || [];
	} catch (error) {
		console.error('Error in getEventModes:', error);
		return [];
	}
}

// User Management Services
export async function getAllUsers(supabase: SupabaseClient<Database>): Promise<Profile[]> {
	try {
		// First try with profile_type
		let { data, error } = await supabase
			.from('profile')
			.select(
				`
				*,
				profile_role:profile_role_id(profile_role_id, name, description),
				profile_type:profile_type_id(profile_type_id, name, description),
				study_program:study_program_id(
					*,
					study_level:study_level_id(name, description),
					study_school:study_school_id(name, description),
					study_course:study_course_id(name, description)
				)
			`
			)
			.is('deleted_at', null)
			.order('created_at', { ascending: false });

		// If that fails, try without profile_type as fallback
		if (error) {
			console.error('Error fetching all users with profile_type:', error);
			console.error('Trying fallback without profile_type...');

			const fallbackResult = await supabase
				.from('profile')
				.select(
					`
					*,
					profile_role:profile_role_id(profile_role_id, name, description),
					study_program:study_program_id(
						*,
						study_level:study_level_id(name, description),
						study_school:study_school_id(name, description),
						study_course:study_course_id(name, description)
					)
				`
				)
				.is('deleted_at', null)
				.order('created_at', { ascending: false });

			data = fallbackResult.data as any;
			error = fallbackResult.error;
		}

		if (error) {
			console.error('Error fetching all users (fallback):', error);
			return [];
		}

		// Add missing profile_type field for fallback data if needed
		const profiles = (data || []).map((item) => ({
			...item,
			profile_type: item.profile_type || null
		})) as unknown as Profile[];

		return profiles;
	} catch (error) {
		console.error('Error in getAllUsers:', error);
		return [];
	}
}

export async function getUsersPaginated(
	supabase: SupabaseClient<Database>,
	params: {
		page: number;
		perPage: number;
		searchTerm?: string;
		roleFilter?: 'all' | 'admin' | 'student';
	}
): Promise<{ users: Profile[]; totalCount: number }> {
	try {
		const { page, perPage, searchTerm = '', roleFilter = 'all' } = params;
		const from = (page - 1) * perPage;
		const to = from + perPage - 1;

		// First, get the role IDs for filtering
		let adminRoleIds: string[] = [];
		let userRoleId: string | null = null;

		if (roleFilter !== 'all') {
			const { data: roles } = await supabase.from('profile_role').select('profile_role_id, name');

			if (roles) {
				if (roleFilter === 'admin') {
					adminRoleIds = roles
						.filter((r) => r.name === 'Admin' || r.name === 'Superadmin')
						.map((r) => r.profile_role_id);
				} else if (roleFilter === 'student') {
					const userRole = roles.find((r) => r.name === 'User');
					userRoleId = userRole?.profile_role_id || null;
				}
			}
		}

		// Build the base query
		let query = supabase
			.from('profile')
			.select(
				`
				*,
				profile_role:profile_role_id(profile_role_id, name, description),
				profile_type:profile_type_id(profile_type_id, name, description),
				study_program:study_program_id(
					*,
					study_level:study_level_id(name, description),
					study_school:study_school_id(name, description),
					study_course:study_course_id(name, description)
				)
			`,
				{ count: 'exact' }
			)
			.is('deleted_at', null);

		// Apply role filter at database level
		if (roleFilter === 'admin' && adminRoleIds.length > 0) {
			query = query.in('profile_role_id', adminRoleIds);
		} else if (roleFilter === 'student' && userRoleId) {
			query = query.eq('profile_role_id', userRoleId);
		}

		// Apply search filter - handle both text fields and numeric student_id
		if (searchTerm.trim()) {
			const trimmedSearch = searchTerm.trim();
			// Check if the search term is numeric (could be student ID)
			const isNumeric = /^\d+$/.test(trimmedSearch);

			if (isNumeric) {
				// If numeric, search in student_id as number OR in text fields
				query = query.or(
					`full_name.ilike.%${trimmedSearch}%,student_id.eq.${trimmedSearch},email.ilike.%${trimmedSearch}%`
				);
			} else {
				// If not numeric, only search in text fields
				query = query.or(`full_name.ilike.%${trimmedSearch}%,email.ilike.%${trimmedSearch}%`);
			}
		}

		// Execute query with pagination
		const { data, error, count } = await query
			.order('created_at', { ascending: false })
			.range(from, to);

		if (error) {
			console.error('Error fetching paginated users:', error);
			// Try fallback without profile_type
			let fallbackQuery = supabase
				.from('profile')
				.select(
					`
					*,
					profile_role:profile_role_id(profile_role_id, name, description),
					study_program:study_program_id(
						*,
						study_level:study_level_id(name, description),
						study_school:study_school_id(name, description),
						study_course:study_course_id(name, description)
					)
				`,
					{ count: 'exact' }
				)
				.is('deleted_at', null);

			// Apply role filter at database level
			if (roleFilter === 'admin' && adminRoleIds.length > 0) {
				fallbackQuery = fallbackQuery.in('profile_role_id', adminRoleIds);
			} else if (roleFilter === 'student' && userRoleId) {
				fallbackQuery = fallbackQuery.eq('profile_role_id', userRoleId);
			}

			// Apply search filter
			if (searchTerm.trim()) {
				const trimmedSearch = searchTerm.trim();
				const isNumeric = /^\d+$/.test(trimmedSearch);

				if (isNumeric) {
					fallbackQuery = fallbackQuery.or(
						`full_name.ilike.%${trimmedSearch}%,student_id.eq.${trimmedSearch},email.ilike.%${trimmedSearch}%`
					);
				} else {
					fallbackQuery = fallbackQuery.or(
						`full_name.ilike.%${trimmedSearch}%,email.ilike.%${trimmedSearch}%`
					);
				}
			}

			const fallbackResult = await fallbackQuery
				.order('created_at', { ascending: false })
				.range(from, to);

			if (fallbackResult.error) {
				console.error('Error in fallback query:', fallbackResult.error);
				return { users: [], totalCount: 0 };
			}

			const users = (fallbackResult.data || []).map((item) => ({
				...item,
				profile_type: null
			})) as unknown as Profile[];

			return { users, totalCount: fallbackResult.count || 0 };
		}

		const users = (data || []).map((item) => ({
			...item,
			profile_type: item.profile_type || null
		})) as unknown as Profile[];

		return { users, totalCount: count || 0 };
	} catch (error) {
		console.error('Error in getUsersPaginated:', error);
		return { users: [], totalCount: 0 };
	}
}

export async function deleteUser(
	supabase: SupabaseClient<Database>,
	profileId: string,
	deletedBy: string
): Promise<boolean> {
	try {
		const { error } = await supabase
			.from('profile')
			.update({
				deleted_at: new Date().toISOString(),
				deleted_by: deletedBy
			})
			.eq('profile_id', profileId);

		if (error) {
			console.error('Error deleting user:', error);
			return false;
		}

		return true;
	} catch (error) {
		console.error('Error in deleteUser:', error);
		return false;
	}
}

export async function updateUserRole(
	supabase: SupabaseClient<Database>,
	profileId: string,
	newRoleId: string,
	modifiedBy: string
): Promise<boolean> {
	try {
		const { error } = await supabase
			.from('profile')
			.update({
				profile_role_id: newRoleId,
				modified_at: new Date().toISOString(),
				modified_by: modifiedBy
			})
			.eq('profile_id', profileId);

		if (error) {
			console.error('Error updating user role:', error);
			return false;
		}

		return true;
	} catch (error) {
		console.error('Error in updateUserRole:', error);
		return false;
	}
}

export async function updateUserRoleByName(
	supabase: SupabaseClient<Database>,
	profileId: string,
	newRoleName: string,
	modifiedBy: string
): Promise<boolean> {
	try {
		// Get the role ID for the new role name
		const roleData = await getProfileRoleByName(supabase, newRoleName);
		if (!roleData) {
			console.error(`Profile role "${newRoleName}" not found`);
			return false;
		}

		return await updateUserRole(supabase, profileId, roleData.profile_role_id, modifiedBy);
	} catch (error) {
		console.error('Error in updateUserRoleByName:', error);
		return false;
	}
}

// Get organisations where user has leadership roles (Owner or Leader)
export async function getUserLeadershipOrganisations(
	supabase: SupabaseClient<Database>,
	profileId: string
): Promise<Organisation[]> {
	try {
		const { data, error } = await supabase
			.from('organisation_member')
			.select(
				`
				organisation:organisation_id (
					organisation_id,
					name,
					description,
					created_at,
					created_by,
					modified_at,
					modified_by,
					deleted_at,
					deleted_by
				),
				organisation_role:role_id (
					name,
					description
				)
			`
			)
			.eq('profile_id', profileId)
			.is('deleted_at', null)
			.in('organisation_role.name', ['Owner', 'Leader'])
			.is('organisation.deleted_at', null);

		if (error) {
			console.error('Error fetching user leadership organisations:', error);
			return [];
		}

		// Extract unique organisations from the results
		const organisations =
			data?.map((member: any) => member.organisation).filter((org: any) => org !== null) || [];

		// Remove duplicates based on organisation_id
		const uniqueOrganisations = organisations.reduce(
			(acc: Organisation[], current: Organisation) => {
				const existing = acc.find((org) => org.organisation_id === current.organisation_id);
				if (!existing) {
					acc.push(current);
				}
				return acc;
			},
			[]
		);

		return uniqueOrganisations;
	} catch (error) {
		console.error('Error in getUserLeadershipOrganisations:', error);
		return [];
	}
}

// Get events for organisations where user has leadership roles
export async function getEventsForUserOrganisations(
	supabase: SupabaseClient<Database>,
	profileId: string,
	filters?: {
		organisation_id?: string;
		event_state?: string;
		limit?: number;
		offset?: number;
	}
): Promise<{ events: Event[]; count: number }> {
	try {
		// First get the organisations where user has leadership roles
		const userOrganisations = await getUserLeadershipOrganisations(supabase, profileId);

		if (userOrganisations.length === 0) {
			return { events: [], count: 0 };
		}

		const organisationIds = userOrganisations.map((org) => org.organisation_id);

		let query = supabase
			.from('event')
			.select(
				`
				*,
				organisation:organisation_id(name, description),
				event_state:event_state_id(name, description),
				event_mode:event_mode_id(name, description),
				registrations:registration(registration_id, deleted_at)
			`,
				{ count: 'exact' }
			)
			.is('deleted_at', null)
			.in('organisation_id', organisationIds);

		if (filters?.organisation_id) {
			query = query.eq('organisation_id', filters.organisation_id);
		}

		if (filters?.event_state) {
			// First get the event_state_id for the given state name
			const { data: eventStateData, error: eventStateError } = await supabase
				.from('event_state')
				.select('event_state_id')
				.eq('name', filters.event_state)
				.single();

			if (eventStateError) {
				console.error('Error fetching event state:', eventStateError);
				return { events: [], count: 0 };
			}

			if (eventStateData) {
				query = query.eq('event_state_id', eventStateData.event_state_id);
			} else {
				// If no matching event state found, return empty results
				return { events: [], count: 0 };
			}
		}

		if (filters?.limit) {
			query = query.limit(filters.limit);
		}

		if (filters?.offset) {
			query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
		}

		const { data, error, count } = await query.order('start_datetime', { ascending: false });

		if (error) {
			console.error('Error fetching events for user organisations:', error);
			return { events: [], count: 0 };
		}

		const now = new Date();
		const eventsWithCount = (data || []).map((event) => ({
			...event,
			registration_count: event.registrations?.filter((reg: any) => !reg.deleted_at)?.length || 0,
			registerable: event.registration_closing_datetime
				? new Date(event.registration_closing_datetime) > now
				: false
		})) as unknown as Event[];

		return { events: eventsWithCount, count: count || 0 };
	} catch (error) {
		console.error('Error in getEventsForUserOrganisations:', error);
		return { events: [], count: 0 };
	}
}

// Attendance Services
export async function markAttendance(
	supabase: SupabaseClient<Database>,
	registrationId: string
): Promise<{ success: boolean; message: string; attendeeName?: string }> {
	try {
		// Get current authenticated user
		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser();
		if (authError || !user) {
			console.error('Authentication error:', authError);
			return { success: false, message: 'Authentication required' };
		}

		// First verify the registration exists and is valid (not deleted), and get attendee info
		const { data: registration, error: regError } = await supabase
			.from('registration')
			.select(
				`
				registration_id,
				event_id,
				profile_id,
				attended,
				profile:profile_id(full_name, student_id),
				event:event_id(name)
			`
			)
			.eq('registration_id', registrationId)
			.is('deleted_at', null)
			.maybeSingle();

		if (regError) {
			console.error('Error checking registration:', regError);
			return { success: false, message: 'Database error checking registration' };
		}

		if (!registration) {
			console.error('Registration not found or has been deleted');
			return { success: false, message: 'Registration not found or invalid QR code' };
		}

		const attendeeName = (registration.profile as any)?.full_name || 'Unknown';
		const studentId = (registration.profile as any)?.student_id;

		// Check if attendance is already marked
		if (registration.attended) {
			console.log('Attendance already marked for this registration');
			return {
				success: false,
				message: `Attendance already marked for ${attendeeName}${studentId ? ` (${studentId})` : ''}`,
				attendeeName
			};
		}

		// Update registration to mark attendance
		const { error } = await supabase
			.from('registration')
			.update({
				attended: true,
				attendance_recorded_by: user.id,
				attendance_recorded_at: new Date().toISOString(),
				modified_at: new Date().toISOString(),
				modified_by: user.id
			})
			.eq('registration_id', registrationId);

		if (error) {
			console.error('Error marking attendance:', error);

			// Check for permission denied error (RLS policy violation)
			if ((error as any).code === '42501') {
				const eventName = (registration.event as any)?.name || 'this event';
				return {
					success: false,
					message: `You don't have permission to mark attendance for ${eventName}. Only event organisers can use the scanner.`
				};
			}

			return { success: false, message: 'Failed to mark attendance' };
		}

		return {
			success: true,
			message: `Attendance marked for ${attendeeName}${studentId ? ` (${studentId})` : ''}`,
			attendeeName
		};
	} catch (error) {
		console.error('Error in markAttendance:', error);
		return { success: false, message: 'Unexpected error occurred' };
	}
}

export async function unmarkAttendance(
	supabase: SupabaseClient<Database>,
	registrationId: string
): Promise<boolean> {
	try {
		// Get current authenticated user
		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser();
		if (authError || !user) {
			console.error('Authentication error:', authError);
			return false;
		}

		// First check if registration exists and has attendance marked
		const { data: registration, error: checkError } = await supabase
			.from('registration')
			.select('registration_id, attended')
			.eq('registration_id', registrationId)
			.is('deleted_at', null)
			.maybeSingle();

		if (checkError) {
			console.error('Error checking registration:', checkError);
			return false;
		}

		if (!registration || !registration.attended) {
			console.log('No attendance marked for this registration');
			return false;
		}

		// Update registration to unmark attendance
		const { error } = await supabase
			.from('registration')
			.update({
				attended: false,
				attendance_recorded_by: null,
				attendance_recorded_at: null,
				modified_at: new Date().toISOString(),
				modified_by: user.id
			})
			.eq('registration_id', registrationId);

		if (error) {
			console.error('Error unmarking attendance:', error);
			return false;
		}

		return true;
	} catch (error) {
		console.error('Error in unmarkAttendance:', error);
		return false;
	}
}

// Event Review Services
export async function reviewEvent(
	supabase: SupabaseClient<Database>,
	eventId: string,
	reviewData: {
		emsNumber?: string;
		emsUrl?: string;
		reviewerNotes?: string;
		reviewedBy: string;
		approved: boolean;
	}
): Promise<{ success: boolean; error?: string }> {
	try {
		// Get the appropriate event state ID
		const targetState = reviewData.approved ? EVENT_STATES.APPROVED : EVENT_STATES.REJECTED;
		const { data: eventState, error: stateError } = await supabase
			.from('event_state')
			.select('event_state_id')
			.eq('name', targetState)
			.single();

		if (stateError || !eventState) {
			console.error('Error fetching event state:', stateError);
			return { success: false, error: 'Failed to get event state' };
		}

		// Update the event with review information
		const updateData: any = {
			event_state_id: eventState.event_state_id,
			reviewed_by: reviewData.reviewedBy,
			reviewed_at: new Date().toISOString(),
			modified_at: new Date().toISOString(),
			modified_by: reviewData.reviewedBy
		};

		// Add optional fields if provided
		if (reviewData.emsNumber) {
			updateData.ems_number = reviewData.emsNumber;
		}
		if (reviewData.emsUrl) {
			updateData.ems_url = reviewData.emsUrl;
		}
		if (reviewData.reviewerNotes) {
			updateData.reviewer_notes = reviewData.reviewerNotes;
		}

		const { error: updateError } = await supabase
			.from('event')
			.update(updateData)
			.eq('event_id', eventId);

		if (updateError) {
			console.error('Error updating event:', updateError);
			return { success: false, error: 'Failed to update event' };
		}

		return { success: true };
	} catch (error) {
		console.error('Error in reviewEvent:', error);
		return { success: false, error: 'An unexpected error occurred' };
	}
}

// Event Management Services
export async function updateEvent(
	supabase: SupabaseClient<Database>,
	eventId: string,
	eventData: Partial<Event>,
	modifiedBy: string
): Promise<{ success: boolean; error?: string }> {
	try {
		const updateData = {
			...eventData,
			modified_at: new Date().toISOString(),
			modified_by: modifiedBy
		};

		const { error } = await supabase.from('event').update(updateData).eq('event_id', eventId);

		if (error) {
			console.error('Error updating event:', error);
			return { success: false, error: 'Failed to update event' };
		}

		return { success: true };
	} catch (error) {
		console.error('Error in updateEvent:', error);
		return { success: false, error: 'An unexpected error occurred' };
	}
}

export async function requestEventUpdate(
	supabase: SupabaseClient<Database>,
	eventId: string,
	updateRequest: any
): Promise<Event | null> {
	try {
		const { data, error } = await supabase
			.from('event')
			.update({
				event_update_request: updateRequest,
				modified_at: new Date().toISOString()
			})
			.eq('event_id', eventId)
			.select(
				`
				*,
				organisation:organisation_id(*),
				event_state:event_state_id(*),
				event_mode:event_mode_id(*)
			`
			)
			.single();

		if (error) {
			console.error('Error requesting event update:', error);
			return null;
		}

		return data as Event;
	} catch (error) {
		console.error('Error in requestEventUpdate:', error);
		return null;
	}
}

export async function clearEventUpdateRequest(
	supabase: SupabaseClient<Database>,
	eventId: string
): Promise<Event | null> {
	try {
		const { data, error } = await supabase
			.from('event')
			.update({
				event_update_request: null,
				modified_at: new Date().toISOString()
			})
			.eq('event_id', eventId)
			.select(
				`
				*,
				organisation:organisation_id(*),
				event_state:event_state_id(*),
				event_mode:event_mode_id(*)
			`
			)
			.single();

		if (error) {
			console.error('Error clearing event update request:', error);
			return null;
		}

		return data as Event;
	} catch (error) {
		console.error('Error in clearEventUpdateRequest:', error);
		return null;
	}
}

export async function submitEventForApproval(
	supabase: SupabaseClient<Database>,
	eventId: string,
	submittedBy: string
): Promise<{ success: boolean; error?: string }> {
	try {
		// Get the pending event state ID
		const { data: eventState, error: stateError } = await supabase
			.from('event_state')
			.select('event_state_id')
			.eq('name', EVENT_STATES.PENDING)
			.single();

		if (stateError || !eventState) {
			console.error('Error fetching pending event state:', stateError);
			return { success: false, error: 'Failed to get pending event state' };
		}

		const { error } = await supabase
			.from('event')
			.update({
				event_state_id: eventState.event_state_id,
				modified_at: new Date().toISOString(),
				modified_by: submittedBy
			})
			.eq('event_id', eventId);

		if (error) {
			console.error('Error submitting event for approval:', error);
			return { success: false, error: 'Failed to submit event for approval' };
		}

		return { success: true };
	} catch (error) {
		console.error('Error in submitEventForApproval:', error);
		return { success: false, error: 'An unexpected error occurred' };
	}
}

export async function cancelEvent(
	supabase: SupabaseClient<Database>,
	eventId: string,
	cancelledBy: string,
	cancellationNote?: string
): Promise<{ success: boolean; error?: string }> {
	try {
		// Get the cancelled event state ID
		const { data: eventState, error: stateError } = await supabase
			.from('event_state')
			.select('event_state_id')
			.eq('name', EVENT_STATES.CANCELLED)
			.single();

		if (stateError || !eventState) {
			console.error('Error fetching cancelled event state:', stateError);
			return { success: false, error: 'Failed to get cancelled event state' };
		}

		// Prepare update data
		const updateData: any = {
			event_state_id: eventState.event_state_id,
			modified_at: new Date().toISOString(),
			modified_by: cancelledBy
		};

		// If cancellation note is provided, update the note_to_registrants field
		if (cancellationNote && cancellationNote.trim()) {
			updateData.note_to_registrants = cancellationNote.trim();
		}

		const { error: updateError } = await supabase
			.from('event')
			.update(updateData)
			.eq('event_id', eventId);

		if (updateError) {
			console.error('Error cancelling event:', updateError);
			return { success: false, error: 'Failed to cancel event' };
		}

		return { success: true };
	} catch (error) {
		console.error('Error in cancelEvent:', error);
		return { success: false, error: 'An unexpected error occurred' };
	}
}

export async function deleteEvent(
	supabase: SupabaseClient<Database>,
	eventId: string,
	deletedBy: string
): Promise<{ success: boolean; error?: string }> {
	try {
		const { error } = await supabase
			.from('event')
			.update({
				deleted_at: new Date().toISOString(),
				deleted_by: deletedBy
			})
			.eq('event_id', eventId);

		if (error) {
			console.error('Error deleting event:', error);
			return { success: false, error: 'Failed to delete event' };
		}

		return { success: true };
	} catch (error) {
		console.error('Error in deleteEvent:', error);
		return { success: false, error: 'An unexpected error occurred' };
	}
}

// Event Permission Services
export async function checkEventPermissions(
	supabase: SupabaseClient<Database>,
	eventId: string,
	userId: string
): Promise<{ isOrganiser: boolean; isAdmin: boolean; isSuperAdmin: boolean }> {
	try {
		// Get user profile with role
		const { data: profile, error: profileError } = await supabase
			.from('profile')
			.select(
				`
				profile_id,
				profile_role:profile_role_id(name)
			`
			)
			.eq('user_id', userId)
			.single();

		if (profileError) {
			console.error('Error fetching user profile:', profileError);
			return { isOrganiser: false, isAdmin: false, isSuperAdmin: false };
		}

		const roleName = (profile?.profile_role as any)?.name;
		const isAdmin = roleName === 'Admin';
		const isSuperAdmin = roleName === 'Superadmin';

		// Check if user is an organiser of the event
		const { data: event, error: eventError } = await supabase
			.from('event')
			.select(
				`
				organisation_id,
				created_by
			`
			)
			.eq('event_id', eventId)
			.single();

		if (eventError) {
			console.error('Error fetching event:', eventError);
			return { isOrganiser: false, isAdmin, isSuperAdmin };
		}

		// Check if user has leadership role in the organisation (not checking event creator)
		let isOrganiser = false;

		// Check organisation membership with leadership roles
		const { data: membership } = await supabase
			.from('organisation_member')
			.select(
				`
				organisation_role:role_id(name)
			`
			)
			.eq('organisation_id', event.organisation_id)
			.eq('profile_id', profile.profile_id)
			.is('deleted_at', null)
			.maybeSingle();

		const membershipRole = (membership?.organisation_role as any)?.name;
		isOrganiser = membershipRole === 'Owner' || membershipRole === 'Leader';

		return { isOrganiser, isAdmin, isSuperAdmin };
	} catch (error) {
		console.error('Error in checkEventPermissions:', error);
		return { isOrganiser: false, isAdmin: false, isSuperAdmin: false };
	}
}

export async function getEventRegistrations(
	supabase: SupabaseClient<Database>,
	eventId: string
): Promise<Registration[]> {
	try {
		const { data, error } = await supabase
			.from('registration')
			.select(
				`
				*,
				profile:profile_id(
					*,
					profile_role:profile_role_id(name, description),
					profile_type:profile_type_id(profile_type_id, name, description),
					study_program:study_program_id(
						*,
						study_level:study_level_id(name, description),
						study_school:study_school_id(name, description),
						study_course:study_course_id(name, description)
					)
				)
			`
			)
			.eq('event_id', eventId)
			.is('deleted_at', null)
			.order('created_at', { ascending: false });

		if (error) {
			console.error('Error fetching event registrations:', error);
			return [];
		}

		return (data || []) as unknown as Registration[];
	} catch (error) {
		console.error('Error in getEventRegistrations:', error);
		return [];
	}
}

// Update Request Management Services
export async function getPendingUpdateRequests(supabase: SupabaseClient<Database>): Promise<{
	profileRequests: Profile[];
	organisationRequests: Organisation[];
	eventRequests: Event[];
}> {
	try {
		// Get profiles with pending update requests
		const { data: profileRequests, error: profileError } = await supabase
			.from('profile')
			.select(
				`
				*,
				profile_role:profile_role_id(profile_role_id, name, description),
				profile_type:profile_type_id(profile_type_id, name, description),
				study_program:study_program_id(
					*,
					study_level:study_level_id(name, description),
					study_school:study_school_id(name, description),
					study_course:study_course_id(name, description)
				)
			`
			)
			.not('profile_update_request', 'is', null)
			.is('deleted_at', null)
			.order('modified_at', { ascending: false });

		if (profileError) {
			console.error('Error fetching profile update requests:', profileError);
		}

		// Get organisations with pending update requests
		const { data: organisationRequests, error: orgError } = await supabase
			.from('organisation')
			.select('*')
			.not('organisation_update_request', 'is', null)
			.is('deleted_at', null)
			.order('modified_at', { ascending: false });

		if (orgError) {
			console.error('Error fetching organisation update requests:', orgError);
		}

		// Get events with pending update requests
		const { data: eventRequests, error: eventError } = await supabase
			.from('event')
			.select(
				`
				*,
				organisation:organisation_id(name, description),
				event_state:event_state_id(name, description),
				event_mode:event_mode_id(name, description)
			`
			)
			.not('event_update_request', 'is', null)
			.is('deleted_at', null)
			.order('modified_at', { ascending: false });

		if (eventError) {
			console.error('Error fetching event update requests:', eventError);
		}

		return {
			profileRequests: (profileRequests || []) as unknown as Profile[],
			organisationRequests: (organisationRequests || []) as Organisation[],
			eventRequests: (eventRequests || []) as Event[]
		};
	} catch (error) {
		console.error('Error in getPendingUpdateRequests:', error);
		return {
			profileRequests: [],
			organisationRequests: [],
			eventRequests: []
		};
	}
}

export async function approveProfileUpdate(
	supabase: SupabaseClient<Database>,
	profileId: string
): Promise<Profile | null> {
	try {
		// First get the current profile with its update request
		const { data: currentProfile, error: fetchError } = await supabase
			.from('profile')
			.select('*')
			.eq('profile_id', profileId)
			.single();

		if (fetchError || !currentProfile || !currentProfile.profile_update_request) {
			console.error('Error fetching profile or no update request:', fetchError);
			return null;
		}

		const updateRequest = currentProfile.profile_update_request as any;

		// Apply the requested changes and clear the request
		const updates: any = {
			...updateRequest,
			profile_update_request: null,
			modified_at: new Date().toISOString()
		};

		// Handle study_program_id if provided
		if (
			updateRequest?.study_level_id &&
			updateRequest?.study_school_id &&
			updateRequest?.study_course_id
		) {
			const studyProgramId = await getStudyProgram(
				supabase,
				updateRequest.study_level_id,
				updateRequest.study_school_id,
				updateRequest.study_course_id
			);
			if (studyProgramId) {
				updates.study_program_id = studyProgramId;
			}
		}

		// Remove fields that aren't directly on the profile table
		delete updates.study_level_id;
		delete updates.study_school_id;
		delete updates.study_course_id;

		const { data, error } = await supabase
			.from('profile')
			.update(updates)
			.eq('profile_id', profileId)
			.select()
			.single();

		if (error) {
			console.error('Error approving profile update:', error);
			return null;
		}

		return data as Profile;
	} catch (error) {
		console.error('Error in approveProfileUpdate:', error);
		return null;
	}
}

export async function rejectProfileUpdate(
	supabase: SupabaseClient<Database>,
	profileId: string
): Promise<Profile | null> {
	try {
		const { data, error } = await supabase
			.from('profile')
			.update({
				profile_update_request: null,
				modified_at: new Date().toISOString()
			})
			.eq('profile_id', profileId)
			.select()
			.single();

		if (error) {
			console.error('Error rejecting profile update:', error);
			return null;
		}

		return data;
	} catch (error) {
		console.error('Error in rejectProfileUpdate:', error);
		return null;
	}
}

export async function approveOrganisationUpdate(
	supabase: SupabaseClient<Database>,
	organisationId: string
): Promise<Organisation | null> {
	try {
		// First get the current organisation with its update request
		const { data: currentOrganisation, error: fetchError } = await supabase
			.from('organisation')
			.select('*')
			.eq('organisation_id', organisationId)
			.single();

		if (fetchError || !currentOrganisation || !currentOrganisation.organisation_update_request) {
			console.error('Error fetching organisation or no update request:', fetchError);
			return null;
		}

		const updateRequest = currentOrganisation.organisation_update_request as any;

		// Apply the requested changes and clear the request
		const { data, error } = await supabase
			.from('organisation')
			.update({
				...updateRequest,
				organisation_update_request: null,
				modified_at: new Date().toISOString()
			})
			.eq('organisation_id', organisationId)
			.select()
			.single();

		if (error) {
			console.error('Error approving organisation update:', error);
			return null;
		}

		return data;
	} catch (error) {
		console.error('Error in approveOrganisationUpdate:', error);
		return null;
	}
}

export async function rejectOrganisationUpdate(
	supabase: SupabaseClient<Database>,
	organisationId: string
): Promise<Organisation | null> {
	try {
		const { data, error } = await supabase
			.from('organisation')
			.update({
				organisation_update_request: null,
				modified_at: new Date().toISOString()
			})
			.eq('organisation_id', organisationId)
			.select()
			.single();

		if (error) {
			console.error('Error rejecting organisation update:', error);
			return null;
		}

		return data;
	} catch (error) {
		console.error('Error in rejectOrganisationUpdate:', error);
		return null;
	}
}

export async function approveEventUpdate(
	supabase: SupabaseClient<Database>,
	eventId: string
): Promise<Event | null> {
	try {
		// First get the current event with its update request
		const { data: currentEvent, error: fetchError } = await supabase
			.from('event')
			.select('*')
			.eq('event_id', eventId)
			.single();

		if (fetchError || !currentEvent || !currentEvent.event_update_request) {
			console.error('Error fetching event or no update request:', fetchError);
			return null;
		}

		const updateRequest = currentEvent.event_update_request as any;

		// Apply the requested changes and clear the request
		const { data, error } = await supabase
			.from('event')
			.update({
				...updateRequest,
				event_update_request: null,
				modified_at: new Date().toISOString()
			})
			.eq('event_id', eventId)
			.select()
			.single();

		if (error) {
			console.error('Error approving event update:', error);
			return null;
		}

		return data as Event;
	} catch (error) {
		console.error('Error in approveEventUpdate:', error);
		return null;
	}
}

export async function rejectEventUpdate(
	supabase: SupabaseClient<Database>,
	eventId: string
): Promise<Event | null> {
	try {
		const { data, error } = await supabase
			.from('event')
			.update({
				event_update_request: null,
				modified_at: new Date().toISOString()
			})
			.eq('event_id', eventId)
			.select()
			.single();

		if (error) {
			console.error('Error rejecting event update:', error);
			return null;
		}

		return data;
	} catch (error) {
		console.error('Error in rejectEventUpdate:', error);
		return null;
	}
}

// Analytics Services
export interface AnalyticsOverview {
	totalEvents: number;
	totalRegistrations: number;
	totalUsers: number;
	totalOrganisations: number;
	averageAttendanceRate: number;
}

export interface EventAnalytics {
	eventId: string;
	eventName: string;
	organisationName: string;
	registrationCount: number;
	attendanceCount: number;
	attendanceRate: number;
	capacity: number | null;
	utilizationRate: number | null;
	startDate: string;
	eventState: string;
	eventMode: string;
}

export interface MonthlyStats {
	month: string;
	year: number;
	eventCount: number;
	registrationCount: number;
	attendanceCount: number;
}

export interface OrganisationStats {
	organisationId: string;
	organisationName: string;
	eventCount: number;
	totalRegistrations: number;
	totalAttendance: number;
	averageAttendanceRate: number;
	memberCount: number;
}

export interface UserInsights {
	totalActiveUsers: number;
	newUsersThisPeriod: number;
	userEngagementRate: number;
	averageEventsPerUser: number;
	topStudyPrograms: Array<{
		programName: string;
		userCount: number;
		percentage: number;
	}>;
	usersByRole: Array<{
		roleName: string;
		userCount: number;
		percentage: number;
	}>;
	usersByEnrollmentYear: Array<{
		enrollmentYear: string;
		userCount: number;
		percentage: number;
	}>;
	engagementTrends: Array<{
		period: string;
		activeUsers: number;
		newRegistrations: number;
		totalAttendance: number;
	}>;
	mostEngagedUsers: Array<{
		userId: string;
		userName: string;
		eventsRegistered: number;
		eventsAttended: number;
		attendanceRate: number;
	}>;
}

export async function getAnalyticsOverview(
	supabase: SupabaseClient<Database>,
	startDate?: string,
	endDate?: string
): Promise<AnalyticsOverview | null> {
	try {
		let eventQuery = supabase.from('event').select('event_id, capacity').is('deleted_at', null);

		if (startDate) {
			eventQuery = eventQuery.gte('start_datetime', startDate);
		}
		if (endDate) {
			eventQuery = eventQuery.lte('start_datetime', endDate);
		}

		let registrationQuery = supabase
			.from('registration')
			.select('registration_id, attended, event:event_id!inner(event_id)')
			.is('deleted_at', null);

		if (startDate || endDate) {
			let eventSubQuery = supabase.from('event').select('event_id').is('deleted_at', null);

			if (startDate) {
				eventSubQuery = eventSubQuery.gte('start_datetime', startDate);
			}
			if (endDate) {
				eventSubQuery = eventSubQuery.lte('start_datetime', endDate);
			}

			const { data: eventIds } = await eventSubQuery;
			if (eventIds && eventIds.length > 0) {
				registrationQuery = registrationQuery.in(
					'event_id',
					eventIds.map((e: any) => e.event_id)
				);
			}
		}

		const [eventsResult, registrationsResult, usersResult, orgsResult] = await Promise.all([
			eventQuery,
			registrationQuery,
			supabase.from('profile').select('profile_id', { count: 'exact' }).is('deleted_at', null),
			supabase
				.from('organisation')
				.select('organisation_id', { count: 'exact' })
				.is('deleted_at', null)
		]);

		if (eventsResult.error || registrationsResult.error || usersResult.error || orgsResult.error) {
			console.error('Error fetching analytics overview:', {
				events: eventsResult.error,
				registrations: registrationsResult.error,
				users: usersResult.error,
				orgs: orgsResult.error
			});
			return null;
		}

		const events = eventsResult.data || [];
		const registrations = registrationsResult.data || [];
		const totalEvents = events.length;
		const totalRegistrations = registrations.length;
		const totalAttendance = registrations.filter((r: any) => r.attended).length;

		return {
			totalEvents,
			totalRegistrations,
			totalUsers: usersResult.count || 0,
			totalOrganisations: orgsResult.count || 0,
			averageAttendanceRate:
				totalRegistrations > 0 ? (totalAttendance / totalRegistrations) * 100 : 0
		};
	} catch (error) {
		console.error('Error in getAnalyticsOverview:', error);
		return null;
	}
}

export async function getEventAnalytics(
	supabase: SupabaseClient<Database>,
	startDate?: string,
	endDate?: string,
	organisationId?: string
): Promise<EventAnalytics[]> {
	try {
		let query = supabase
			.from('event')
			.select(
				`
        event_id,
        name,
        capacity,
        start_datetime,
        organisation_id,
        event_state_id,
        event_mode_id,
        organisation:organisation_id(name),
        event_state:event_state_id(name),
        event_mode:event_mode_id(name)
      `
			)
			.is('deleted_at', null);

		if (startDate) {
			query = query.gte('start_datetime', startDate);
		}
		if (endDate) {
			query = query.lte('start_datetime', endDate);
		}
		if (organisationId) {
			query = query.eq('organisation_id', organisationId);
		}

		const { data: events, error: eventsError } = await query;

		if (eventsError) {
			console.error('Error fetching events:', eventsError);
			return [];
		}

		if (!events || events.length === 0) {
			return [];
		}

		// Get registrations for these events
		const { data: registrations, error: registrationsError } = await supabase
			.from('registration')
			.select('event_id, attended')
			.in(
				'event_id',
				events.map((e: any) => e.event_id)
			)
			.is('deleted_at', null);

		if (registrationsError) {
			console.error('Error fetching registrations:', registrationsError);
			return [];
		}

		// Group registrations by event
		const registrationsByEvent = new Map<string, any[]>();
		(registrations || []).forEach((reg: any) => {
			if (!registrationsByEvent.has(reg.event_id)) {
				registrationsByEvent.set(reg.event_id, []);
			}
			registrationsByEvent.get(reg.event_id)!.push(reg);
		});

		return events.map((event: any) => {
			const eventRegistrations = registrationsByEvent.get(event.event_id) || [];
			const registrationCount = eventRegistrations.length;
			const attendanceCount = eventRegistrations.filter((r: any) => r.attended).length;
			const attendanceRate =
				registrationCount > 0 ? (attendanceCount / registrationCount) * 100 : 0;
			const utilizationRate =
				event.capacity && event.capacity > 0 ? (registrationCount / event.capacity) * 100 : null;

			return {
				eventId: event.event_id,
				eventName: event.name,
				organisationName: event.organisation?.name || 'Unknown',
				registrationCount,
				attendanceCount,
				attendanceRate,
				capacity: event.capacity,
				utilizationRate,
				startDate: event.start_datetime,
				eventState: event.event_state?.name || 'Unknown',
				eventMode: event.event_mode?.name || 'Unknown'
			};
		});
	} catch (error) {
		console.error('Error in getEventAnalytics:', error);
		return [];
	}
}

export async function getMonthlyStats(
	supabase: SupabaseClient<Database>,
	startDate?: string,
	endDate?: string
): Promise<MonthlyStats[]> {
	try {
		let eventQuery = supabase
			.from('event')
			.select('event_id, start_datetime')
			.is('deleted_at', null)
			.order('start_datetime');

		if (startDate) {
			eventQuery = eventQuery.gte('start_datetime', startDate);
		}
		if (endDate) {
			eventQuery = eventQuery.lte('start_datetime', endDate);
		}

		const { data: events, error: eventsError } = await eventQuery;

		if (eventsError) {
			console.error('Error fetching events for monthly stats:', eventsError);
			return [];
		}

		if (!events || events.length === 0) {
			return [];
		}

		// Get registrations for these events
		const { data: registrations, error: registrationsError } = await supabase
			.from('registration')
			.select('event_id, attended')
			.in(
				'event_id',
				events.map((e: any) => e.event_id)
			)
			.is('deleted_at', null);

		if (registrationsError) {
			console.error('Error fetching registrations for monthly stats:', registrationsError);
			return [];
		}

		// Group registrations by event
		const registrationsByEvent = new Map<string, any[]>();
		(registrations || []).forEach((reg: any) => {
			if (!registrationsByEvent.has(reg.event_id)) {
				registrationsByEvent.set(reg.event_id, []);
			}
			registrationsByEvent.get(reg.event_id)!.push(reg);
		});

		const monthlyData = new Map<string, MonthlyStats>();

		events.forEach((event: any) => {
			const date = new Date(event.start_datetime);
			const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
			const monthName = date.toLocaleDateString('en-US', { month: 'long' });

			if (!monthlyData.has(monthKey)) {
				monthlyData.set(monthKey, {
					month: monthName,
					year: date.getFullYear(),
					eventCount: 0,
					registrationCount: 0,
					attendanceCount: 0
				});
			}

			const stats = monthlyData.get(monthKey)!;
			const eventRegistrations = registrationsByEvent.get(event.event_id) || [];

			stats.eventCount++;
			stats.registrationCount += eventRegistrations.length;
			stats.attendanceCount += eventRegistrations.filter((r: any) => r.attended).length;
		});

		return Array.from(monthlyData.values()).sort((a, b) => {
			if (a.year !== b.year) return a.year - b.year;
			return (
				new Date(`${a.month} 1, ${a.year}`).getMonth() -
				new Date(`${b.month} 1, ${b.year}`).getMonth()
			);
		});
	} catch (error) {
		console.error('Error in getMonthlyStats:', error);
		return [];
	}
}

export async function getOrganisationStats(
	supabase: SupabaseClient<Database>,
	startDate?: string,
	endDate?: string
): Promise<OrganisationStats[]> {
	try {
		let eventQuery = supabase
			.from('event')
			.select('event_id, organisation_id, organisation:organisation_id(name)')
			.is('deleted_at', null);

		if (startDate) {
			eventQuery = eventQuery.gte('start_datetime', startDate);
		}
		if (endDate) {
			eventQuery = eventQuery.lte('start_datetime', endDate);
		}

		const [eventsResult, orgsResult] = await Promise.all([
			eventQuery,
			supabase.from('organisation').select('organisation_id, name').is('deleted_at', null)
		]);

		if (eventsResult.error || orgsResult.error) {
			console.error('Error fetching organisation stats:', {
				events: eventsResult.error,
				orgs: orgsResult.error
			});
			return [];
		}

		const events = eventsResult.data || [];
		const organisations = orgsResult.data || [];

		// Get member counts
		const { data: memberCounts, error: memberError } = await supabase
			.from('organisation_member')
			.select('organisation_id, profile_id')
			.is('deleted_at', null);

		if (memberError) {
			console.error('Error fetching member counts:', memberError);
		}

		const memberCountByOrg = new Map<string, number>();
		(memberCounts || []).forEach((member: any) => {
			memberCountByOrg.set(
				member.organisation_id,
				(memberCountByOrg.get(member.organisation_id) || 0) + 1
			);
		});

		// Get registrations for events in date range
		let registrations: any[] = [];
		if (events.length > 0) {
			const { data: registrationData, error: registrationError } = await supabase
				.from('registration')
				.select('event_id, attended')
				.in(
					'event_id',
					events.map((e: any) => e.event_id)
				)
				.is('deleted_at', null);

			if (registrationError) {
				console.error('Error fetching registrations:', registrationError);
			} else {
				registrations = registrationData || [];
			}
		}

		// Group registrations by event
		const registrationsByEvent = new Map<string, any[]>();
		registrations.forEach((reg: any) => {
			if (!registrationsByEvent.has(reg.event_id)) {
				registrationsByEvent.set(reg.event_id, []);
			}
			registrationsByEvent.get(reg.event_id)!.push(reg);
		});

		const orgStatsMap = new Map<string, OrganisationStats>();

		// Initialize with organisation data
		organisations.forEach((org: any) => {
			orgStatsMap.set(org.organisation_id, {
				organisationId: org.organisation_id,
				organisationName: org.name,
				eventCount: 0,
				totalRegistrations: 0,
				totalAttendance: 0,
				averageAttendanceRate: 0,
				memberCount: memberCountByOrg.get(org.organisation_id) || 0
			});
		});

		// Aggregate event data
		events.forEach((event: any) => {
			const orgId = event.organisation_id;
			if (orgStatsMap.has(orgId)) {
				const stats = orgStatsMap.get(orgId)!;
				const eventRegistrations = registrationsByEvent.get(event.event_id) || [];

				stats.eventCount++;
				stats.totalRegistrations += eventRegistrations.length;
				stats.totalAttendance += eventRegistrations.filter((r: any) => r.attended).length;
			}
		});

		// Calculate attendance rates
		orgStatsMap.forEach((stats) => {
			if (stats.totalRegistrations > 0) {
				stats.averageAttendanceRate = (stats.totalAttendance / stats.totalRegistrations) * 100;
			}
		});

		return Array.from(orgStatsMap.values()).sort((a, b) => b.eventCount - a.eventCount);
	} catch (error) {
		console.error('Error in getOrganisationStats:', error);
		return [];
	}
}

export async function getUserInsights(
	supabase: SupabaseClient<Database>,
	startDate?: string,
	endDate?: string
): Promise<UserInsights> {
	try {
		console.log('getUserInsights called with:', { startDate, endDate });

		// Get all active users (not deleted)
		const { data: users, error: usersError } = await supabase
			.from('profile')
			.select(
				`
				user_id,
				full_name,
				created_at,
				profile_role_id,
				study_program_id,
				enrolment_year
			`
			)
			.is('deleted_at', null);

		if (usersError) {
			console.error('Error fetching users:', usersError);
			throw usersError;
		}

		console.log('Users fetched:', users?.length || 0);

		// Get all role names
		const { data: roles, error: rolesError } = await supabase
			.from('profile_role')
			.select('profile_role_id, name');

		if (rolesError) {
			console.error('Error fetching roles:', rolesError);
		}

		console.log('Roles fetched:', roles?.length || 0);

		// Get study programs
		const { data: studyPrograms, error: studyProgramsError } = await supabase.from('study_program')
			.select(`
				study_program_id,
				study_course:study_course_id (
					name
				)
			`);

		if (studyProgramsError) {
			console.error('Error fetching study programs:', studyProgramsError);
		}

		console.log('Study programs fetched:', studyPrograms?.length || 0);

		// Build registration query with date filtering if needed
		let registrationQuery = supabase
			.from('registration')
			.select(
				`
				profile_id,
				attended,
				created_at,
				event:event_id (
					event_id,
					start_datetime
				)
			`
			)
			.is('deleted_at', null);

		const { data: allRegistrations, error: registrationsError } = await registrationQuery;

		if (registrationsError) {
			console.error('Error fetching registrations:', registrationsError);
		}

		console.log('All registrations fetched:', allRegistrations?.length || 0);

		// Filter registrations by date if specified
		let filteredRegistrations = allRegistrations || [];
		if (startDate || endDate) {
			filteredRegistrations = (allRegistrations || []).filter((reg: any) => {
				if (!reg.event?.start_datetime) return false;
				const eventDate = new Date(reg.event.start_datetime);

				if (startDate && eventDate < new Date(startDate)) return false;
				if (endDate && eventDate > new Date(endDate)) return false;

				return true;
			});
		}

		console.log('Filtered registrations:', filteredRegistrations.length);

		// Calculate basic metrics
		const totalUsers = users?.length || 0;
		const activeUserIds = new Set(filteredRegistrations.map((r: any) => r.profile_id));

		// If there are no registrations in the filtered period, consider all users as potentially active
		// but show them as having low engagement
		const totalActiveUsers = filteredRegistrations.length > 0 ? activeUserIds.size : totalUsers;

		// Calculate new users in period
		let newUsersThisPeriod = 0;
		if (startDate && endDate && users) {
			// Count users created within the specified period
			newUsersThisPeriod = users.filter((user: any) => {
				const userCreatedDate = new Date(user.created_at);
				return userCreatedDate >= new Date(startDate) && userCreatedDate <= new Date(endDate);
			}).length;
		} else if (startDate && users) {
			// If only start date is provided, count from start date onwards
			newUsersThisPeriod = users.filter(
				(user: any) => new Date(user.created_at) >= new Date(startDate)
			).length;
		} else if (endDate && users) {
			// If only end date is provided, count up to end date
			newUsersThisPeriod = users.filter(
				(user: any) => new Date(user.created_at) <= new Date(endDate)
			).length;
		} else {
			// If no date range, show 0 (not all users)
			newUsersThisPeriod = 0;
		}

		// Calculate engagement rate
		// If there are registrations in the period, base it on active users vs total users
		// If no registrations, engagement rate is 0 but show all users as potential
		const userEngagementRate =
			filteredRegistrations.length > 0 && totalUsers > 0
				? (activeUserIds.size / totalUsers) * 100
				: 0;

		// Calculate average events per user
		const totalRegistrations = filteredRegistrations.length;
		const averageEventsPerUser =
			activeUserIds.size > 0 ? totalRegistrations / activeUserIds.size : 0;

		// Calculate study program distribution (exclude null/unknown programs)
		const programCounts = new Map<string, number>();
		const programMap = new Map(
			(studyPrograms || []).map((sp: any) => [
				sp.study_program_id,
				sp.study_course?.name || 'Unknown Program'
			])
		);

		// Count only users with valid study programs
		let usersWithPrograms = 0;
		(users || []).forEach((user: any) => {
			// Skip users without a study program ID
			if (!user.study_program_id) return;

			const programName = programMap.get(user.study_program_id);
			// Skip if program name is unknown or couldn't be found
			if (!programName || programName === 'Unknown Program') return;

			programCounts.set(programName, (programCounts.get(programName) || 0) + 1);
			usersWithPrograms++;
		});

		const topStudyPrograms = Array.from(programCounts.entries())
			.map(([programName, userCount]) => ({
				programName,
				userCount,
				// Calculate percentage based on users with valid programs, not total users
				percentage: usersWithPrograms > 0 ? (userCount / usersWithPrograms) * 100 : 0
			}))
			.sort((a, b) => b.userCount - a.userCount);

		// Calculate user role distribution
		const roleCounts = new Map<string, number>();
		const roleMap = new Map((roles || []).map((r: any) => [r.profile_role_id, r.name]));

		(users || []).forEach((user: any) => {
			const roleName = roleMap.get(user.profile_role_id) || 'Unknown';
			roleCounts.set(roleName, (roleCounts.get(roleName) || 0) + 1);
		});

		const usersByRole = Array.from(roleCounts.entries())
			.map(([roleName, userCount]) => ({
				roleName,
				userCount,
				percentage: totalUsers > 0 ? (userCount / totalUsers) * 100 : 0
			}))
			.sort((a, b) => b.userCount - a.userCount);

		// Calculate enrollment year distribution (exclude null/empty years)
		const enrollmentYearCounts = new Map<string, number>();
		let usersWithEnrollmentYear = 0;

		(users || []).forEach((user: any) => {
			// Skip users without an enrollment year
			if (!user.enrolment_year) return;

			const enrollmentYear = user.enrolment_year.toString();
			enrollmentYearCounts.set(enrollmentYear, (enrollmentYearCounts.get(enrollmentYear) || 0) + 1);
			usersWithEnrollmentYear++;
		});

		const usersByEnrollmentYear = Array.from(enrollmentYearCounts.entries())
			.map(([enrollmentYear, userCount]) => ({
				enrollmentYear,
				userCount,
				// Calculate percentage based on users with valid enrollment years, not total users
				percentage: usersWithEnrollmentYear > 0 ? (userCount / usersWithEnrollmentYear) * 100 : 0
			}))
			.sort((a, b) => {
				// Sort by year descending (newest first)
				return parseInt(b.enrollmentYear) - parseInt(a.enrollmentYear);
			});

		// Calculate monthly engagement trends
		const monthlyData = new Map<
			string,
			{
				activeUsers: Set<string>;
				newRegistrations: number;
				totalAttendance: number;
			}
		>();

		filteredRegistrations.forEach((reg: any) => {
			if (!reg.event?.start_datetime) return;

			const date = new Date(reg.event.start_datetime);
			const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

			if (!monthlyData.has(period)) {
				monthlyData.set(period, {
					activeUsers: new Set(),
					newRegistrations: 0,
					totalAttendance: 0
				});
			}

			const data = monthlyData.get(period)!;
			data.activeUsers.add(reg.profile_id);
			data.newRegistrations++;
			if (reg.attended) {
				data.totalAttendance++;
			}
		});

		const engagementTrends = Array.from(monthlyData.entries())
			.map(([period, data]) => ({
				period,
				activeUsers: data.activeUsers.size,
				newRegistrations: data.newRegistrations,
				totalAttendance: data.totalAttendance
			}))
			.sort((a, b) => a.period.localeCompare(b.period));

		// Calculate most engaged users
		const userEngagement = new Map<
			string,
			{
				userName: string;
				eventsRegistered: number;
				eventsAttended: number;
			}
		>();

		filteredRegistrations.forEach((reg: any) => {
			const userId = reg.profile_id;
			const user = users?.find((u: any) => u.user_id === userId);
			const userName = user?.full_name || 'Unknown User';

			if (!userEngagement.has(userId)) {
				userEngagement.set(userId, {
					userName,
					eventsRegistered: 0,
					eventsAttended: 0
				});
			}

			const userData = userEngagement.get(userId)!;
			userData.eventsRegistered++;
			if (reg.attended) {
				userData.eventsAttended++;
			}
		});

		const mostEngagedUsers = Array.from(userEngagement.entries())
			.map(([userId, data]) => ({
				userId,
				userName: data.userName,
				eventsRegistered: data.eventsRegistered,
				eventsAttended: data.eventsAttended,
				attendanceRate:
					data.eventsRegistered > 0 ? (data.eventsAttended / data.eventsRegistered) * 100 : 0
			}))
			.sort((a, b) => b.eventsRegistered - a.eventsRegistered)
			.slice(0, 10);

		const result: UserInsights = {
			totalActiveUsers,
			newUsersThisPeriod,
			userEngagementRate,
			averageEventsPerUser,
			topStudyPrograms,
			usersByRole,
			usersByEnrollmentYear,
			engagementTrends,
			mostEngagedUsers
		};

		console.log('getUserInsights final result:', result);
		return result;
	} catch (error) {
		console.error('Error in getUserInsights:', error);
		// Return empty data structure on error
		return {
			totalActiveUsers: 0,
			newUsersThisPeriod: 0,
			userEngagementRate: 0,
			averageEventsPerUser: 0,
			topStudyPrograms: [],
			usersByRole: [],
			usersByEnrollmentYear: [],
			engagementTrends: [],
			mostEngagedUsers: []
		};
	}
}
