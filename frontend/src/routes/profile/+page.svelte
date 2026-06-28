<script lang="ts">
	import { onMount } from 'svelte';
	import { getUserProfile } from '$lib/auth';
	import {
		updateUserProfile,
		getStudyLevels,
		getStudySchools,
		getStudyProgramsBySchoolAndLevel,
		requestProfileUpdate,
		clearProfileUpdateRequest
	} from '$lib/database';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { toast } from 'svelte-sonner';
	import { Lock } from '@lucide/svelte';
	import type { Profile, StudyLevel, StudySchool, ProfileType } from '$lib/types';

	let { data } = $props();
	let { supabase } = $derived(data);

	let currentUser = $state<any>(null);
	let profile = $state<Profile | null>(null);
	let loading = $state(true);
	let saving = $state(false);
	let requesting = $state(false);
	let canceling = $state(false);
	let message = $state('');
	let messageType = $state<'success' | 'error'>('success');

	// Form data using $state for better reactivity
	let email = $state('');
	let full_name = $state('');
	let profile_type = $state('');
	let student_id = $state('');
	let gender = $state('');
	let enrolment_year = $state('');
	let enrolment_intake = $state('');
	let study_level_id = $state('');
	let study_school_id = $state('');
	let study_program_id = $state('');

	// Original values to track changes
	let original_full_name = $state('');
	let original_student_id = $state('');
	let original_gender = $state('');
	let original_enrolment_year = $state('');
	let original_enrolment_intake = $state('');
	let original_study_level_id = $state('');
	let original_study_school_id = $state('');
	let original_study_program_id = $state('');

	// Reference data
	let studyLevels = $state<StudyLevel[]>([]);
	let studySchools = $state<StudySchool[]>([]);
	let availablePrograms = $state<any[]>([]); // Study programs available for selected level and school
	let pendingRequest = $state<any>(null); // Current pending update request

	// Derived content for select triggers
	const genderContent = $derived(gender === 'Other' ? 'Prefer not to say' : gender || 'Select your gender');

	const studyLevelContent = $derived(
		studyLevels.find((l) => l.study_level_id === study_level_id)?.name || 'Select your study level'
	);

	const studySchoolContent = $derived(
		studySchools.find((s) => s.study_school_id === study_school_id)?.name || 'Select your school'
	);

	const studyProgramContent = $derived(
		availablePrograms.find((p) => p.study_program_id === study_program_id)?.study_course?.name ||
			(study_school_id && study_level_id
				? availablePrograms.length === 0
					? 'No programs available for this combination'
					: 'Select your program'
				: 'Select level and school first')
	);

	const enrolmentYearContent = $derived(
		enrolment_year || `Enter your enrolment year (e.g., ${new Date().getFullYear()})`
	);

	const enrolmentIntakeContent = $derived(
		enrolment_intake === '2'
			? 'February'
			: enrolment_intake === '7'
				? 'July'
				: enrolment_intake === '10'
					? 'October'
					: 'Select your enrolment intake'
	);

	const studyProgramLabel = $derived(
		availablePrograms.length > 0 ? 'Study Program *' : 'Study Program'
	);

	const profileTypeContent = $derived(profile_type || 'Unknown');

	// Computed variable to check if user is a student
	const isStudent = $derived(profile_type === 'Student');

	// Check if there are any changes from original values
	const hasChanges = $derived(
		full_name !== original_full_name ||
			gender !== original_gender ||
			(isStudent &&
				(student_id !== original_student_id ||
					enrolment_year !== original_enrolment_year ||
					enrolment_intake !== original_enrolment_intake ||
					study_level_id !== original_study_level_id ||
					study_school_id !== original_study_school_id ||
					study_program_id !== original_study_program_id))
	);

	onMount(async () => {
		await loadData();
	});

	// Watch for level and school selection changes using $effect
	$effect(() => {
		if (study_level_id && study_school_id && !loading) {
			loadProgramsForLevelAndSchool(study_level_id, study_school_id);
		}
	});

	async function loadData() {
		try {
			loading = true;

			// Load user profile
			currentUser = await getUserProfile(supabase);
			let profileLevelId = '';
			let profileSchoolId = '';
			let profileProgramId = '';

			if (currentUser?.profile) {
				profile = currentUser.profile;

				// Check for pending update request
				if (profile?.profile_update_request) {
					pendingRequest = profile.profile_update_request;
				}

				// Populate form data
				email = currentUser.email || '';
				full_name = profile?.full_name || '';
				profile_type = profile?.profile_type?.name || '';
				student_id = profile?.student_id?.toString() || '';
				gender = profile?.gender || '';
				enrolment_year = profile?.enrolment_year?.toString() || '';
				enrolment_intake = profile?.enrolment_intake?.toString() || '';

				// Store original values for change detection
				original_full_name = full_name;
				original_student_id = student_id;
				original_gender = gender;
				original_enrolment_year = enrolment_year;
				original_enrolment_intake = enrolment_intake;

				// Store program info for later assignment
				if (profile?.study_program) {
					profileLevelId = profile.study_program.study_level_id || '';
					profileSchoolId = profile.study_program.study_school_id || '';
					profileProgramId = profile.study_program.study_program_id || '';
				}
			}

			// Load reference data
			const [levels, schools] = await Promise.all([getStudyLevels(supabase), getStudySchools(supabase)]);

			studyLevels = levels;
			studySchools = schools;

			// Now set level and school after reference data is loaded
			if (profileLevelId && profileSchoolId) {
				study_level_id = profileLevelId;
				study_school_id = profileSchoolId;

				// Store original values for level and school
				original_study_level_id = profileLevelId;
				original_study_school_id = profileSchoolId;

				// Load programs for the existing level and school selection
				await loadProgramsForLevelAndSchool(profileLevelId, profileSchoolId);

				// Set program after programs are loaded
				if (profileProgramId) {
					study_program_id = profileProgramId;
					original_study_program_id = profileProgramId;
				} else {
					original_study_program_id = '';
				}
			} else {
				// No existing level/school, set original values to empty
				original_study_level_id = '';
				original_study_school_id = '';
				original_study_program_id = '';
			}

			console.log('Loaded data:', {
				studyLevels: studyLevels.length,
				studySchools: studySchools.length,
				study_level_id,
				study_school_id,
				study_program_id,
				availablePrograms: availablePrograms.length
			});
		} catch (error) {
			console.error('Error loading profile data:', error);
			toast('Failed to load profile data.');
		} finally {
			loading = false;
		}
	}

	async function loadProgramsForLevelAndSchool(levelId: string, schoolId: string) {
		try {
			if (!levelId || !schoolId) {
				availablePrograms = [];
				return;
			}

			const programs = await getStudyProgramsBySchoolAndLevel(supabase, levelId, schoolId);
			availablePrograms = programs;

			console.log('Loaded programs for level and school:', {
				levelId,
				schoolId,
				programsCount: availablePrograms.length
			});
		} catch (err) {
			console.error('Error loading programs for level and school:', err);
			availablePrograms = [];
		}
	}

	async function handleSubmit() {
		if (!profile) return;

		try {
			saving = true;
			message = '';

			// Validate required fields
			if (!full_name.trim()) {
				toast('Full name is required.');
				return;
			}

			// Validate full name format (only letters, spaces, apostrophes, hyphens)
			if (!/^[a-zA-Z\s'-]+$/.test(full_name.trim())) {
				toast('Full name can only contain letters, spaces, and punctuation.');
				return;
			}

			// Validate full name length
			if (full_name.trim().length < 2) {
				toast('Full name must be at least 2 characters.');
				return;
			}

			if (full_name.trim().length > 100) {
				toast('Full name is too long.');
				return;
			}

			if (!gender) {
				toast('Gender is required.');
				return;
			}

			// Validate student-specific fields only for students
			if (isStudent) {
				if (!student_id.trim()) {
					toast('Student ID is required.');
					return;
				}

				// Validate student ID format (numerical, max 10 digits)
				const studentIdNum = student_id.trim();
				if (!/^\d+$/.test(studentIdNum)) {
					toast('Student ID must contain only numbers.');
					return;
				}

				if (studentIdNum.length > 10) {
					toast('Student ID is too long.');
					return;
				}

				if (studentIdNum.length < 1) {
					toast('Student ID is required.');
					return;
				}

				if (!enrolment_year.trim()) {
					toast('Enrolment year is required.');
					return;
				}

				// Validate enrolment year format (exactly 4 digits)
				const enrolmentYearNum = enrolment_year.trim();

				// Check if it's a valid number and exactly 4 digits
				if (!/^\d{4}$/.test(enrolmentYearNum)) {
					if (enrolmentYearNum.length !== 4) {
						toast('Enrolment year must be 4 digits.');
					} else {
						toast('Enrolment year must contain only numbers.');
					}
					return;
				}

				// Validate enrolment year range (reasonable range)
				const currentYear = new Date().getFullYear();
				const yearNum = parseInt(enrolmentYearNum, 10);
				if (isNaN(yearNum) || yearNum < 1900 || yearNum > currentYear + 5) {
					toast('Please enter a valid year.');
					return;
				}

				if (!enrolment_intake) {
					toast('Enrolment intake is required.');
					return;
				}

				if (!study_level_id) {
					toast('Study level is required.');
					return;
				}

				if (!study_school_id) {
					toast('Study school is required.');
					return;
				}

				// Study program is only required if there are available programs for the level/school combination
				if (availablePrograms.length > 0 && !study_program_id) {
					toast('Study program is required.');
					return;
				}
			}

			const updates: Partial<Profile> = {
				full_name: full_name.trim(),
				gender: gender || undefined,
				...(isStudent && {
					student_id: parseInt(student_id),
					enrolment_year: parseInt(enrolment_year.trim()),
					enrolment_intake: parseInt(enrolment_intake),
					study_program_id: study_program_id || undefined
				})
			};

			const updatedProfile = await updateUserProfile(supabase, profile.profile_id, updates);

			if (updatedProfile) {
				profile = updatedProfile;
				toast('Profile updated successfully!');
			} else {
				toast('Failed to update profile.');
			}
		} catch (error) {
			console.error('Error updating profile:', error);
			toast('Failed to update profile.');
		} finally {
			saving = false;
		}
	}

	async function handleRequestUpdate() {
		if (!profile) return;

		try {
			requesting = true;
			message = '';

			// Validate required fields
			if (!full_name.trim()) {
				toast('Full name is required.');
				return;
			}

			// Validate full name format (only letters, spaces, apostrophes, hyphens)
			if (!/^[a-zA-Z\s'-]+$/.test(full_name.trim())) {
				toast('Full name can only contain letters, spaces, and punctuation.');
				return;
			}

			// Validate full name length
			if (full_name.trim().length < 2) {
				toast('Full name must be at least 2 characters.');
				return;
			}

			if (full_name.trim().length > 100) {
				toast('Full name is too long.');
				return;
			}

			if (!gender) {
				toast('Gender is required.');
				return;
			}

			// Validate student-specific fields only for students
			if (isStudent) {
				if (!student_id.trim()) {
					toast('Student ID is required.');
					return;
				}

				// Validate student ID format (numerical, max 10 digits)
				const studentIdNum = student_id.trim();
				if (!/^\d+$/.test(studentIdNum)) {
					toast('Student ID must contain only numbers.');
					return;
				}

				if (studentIdNum.length > 10) {
					toast('Student ID is too long.');
					return;
				}

				if (studentIdNum.length < 1) {
					toast('Student ID is required.');
					return;
				}

				if (!enrolment_year.trim()) {
					toast('Enrolment year is required.');
					return;
				}

				// Validate enrolment year format (exactly 4 digits)
				const enrolmentYearNum = enrolment_year.trim();

				// Check if it's a valid number and exactly 4 digits
				if (!/^\d{4}$/.test(enrolmentYearNum)) {
					if (enrolmentYearNum.length !== 4) {
						toast('Enrolment year must be 4 digits.');
					} else {
						toast('Enrolment year must contain only numbers.');
					}
					return;
				}

				// Validate enrolment year range (reasonable range)
				const currentYear = new Date().getFullYear();
				const yearNum = parseInt(enrolmentYearNum, 10);
				if (isNaN(yearNum) || yearNum < 1900 || yearNum > currentYear + 5) {
					toast('Please enter a valid year.');
					return;
				}

				if (!enrolment_intake) {
					toast('Enrolment intake is required.');
					return;
				}

				if (!study_level_id) {
					toast('Study level is required.');
					return;
				}

				if (!study_school_id) {
					toast('Study school is required.');
					return;
				}

				// Study program is only required if there are available programs for the level/school combination
				if (availablePrograms.length > 0 && !study_program_id) {
					toast('Study program is required.');
					return;
				}
			}

			// Create the update request object
			const updateRequest: any = {
				full_name: full_name.trim(),
				gender: gender || null
			};

			if (isStudent) {
				updateRequest.student_id = parseInt(student_id);
				updateRequest.enrolment_year = parseInt(enrolment_year.trim());
				updateRequest.enrolment_intake = parseInt(enrolment_intake);
				updateRequest.study_level_id = study_level_id;
				updateRequest.study_school_id = study_school_id;
				updateRequest.study_program_id = study_program_id || null;
			}

			const updatedProfile = await requestProfileUpdate(supabase, profile.profile_id, updateRequest);

			if (updatedProfile) {
				profile = updatedProfile;
				pendingRequest = updateRequest;
				toast('Profile update request submitted successfully!');
			} else {
				toast('Failed to submit profile update request.');
			}
		} catch (error) {
			console.error('Error requesting profile update:', error);
			toast('Failed to submit profile update request.');
		} finally {
			requesting = false;
		}
	}

	async function handleCancelRequest() {
		if (!profile) return;

		try {
			canceling = true;

			const updatedProfile = await clearProfileUpdateRequest(supabase, profile.profile_id);

			if (updatedProfile) {
				profile = updatedProfile;
				pendingRequest = null;
				toast('Profile update request cancelled successfully!');
			} else {
				toast('Failed to cancel profile update request.');
			}
		} catch (error) {
			console.error('Error cancelling profile update request:', error);
			toast('Failed to cancel profile update request.');
		} finally {
			canceling = false;
		}
	}
</script>

<svelte:head>
	<title>Profile - SEMS</title>
	<meta
		name="description"
		content="Manage your student profile, academic details, and personal information on the SEMS platform."
	/>
	<meta
		name="keywords"
		content="student profile, account settings, academic details, personal information"
	/>
	<meta property="og:title" content="Profile - SEMS" />
	<meta
		property="og:description"
		content="Manage your student profile, academic details, and personal information on the SEMS platform."
	/>
	<meta property="og:type" content="website" />
	<meta name="robots" content="noindex, nofollow" />
	<link rel="canonical" href="/profile" />
</svelte:head>

<div class="container mx-auto max-w-2xl px-4 py-8">
	<div class="mb-8">
		<h1 class="mb-2 text-3xl font-bold text-gray-900">Profile</h1>
		<p class="text-gray-600">Manage your personal information and academic details.</p>
	</div>

	{#if pendingRequest}
		<Card class="mb-6 border-orange-200 bg-orange-50">
			<CardHeader>
				<CardTitle class="flex items-center text-orange-800">
					<svg class="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
							clip-rule="evenodd"
						/>
					</svg>
					Pending Update Request
				</CardTitle>
				<CardDescription class="text-orange-700">
					Pending profile update request submitted.
				</CardDescription>
			</CardHeader>
			<CardContent class="flex justify-end">
				<Button variant="outline" size="sm" disabled={canceling} onclick={handleCancelRequest}>
					{#if canceling}
						<div class="mr-2 h-3 w-3 animate-spin rounded-full border-b-2 border-current"></div>
						Cancelling...
					{:else}
						Cancel Request
					{/if}
				</Button>
			</CardContent>
		</Card>
	{/if}

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
			<span class="ml-2">Loading profile...</span>
		</div>
	{:else if !currentUser}
		<Card class="py-12 text-center">
			<CardContent>
				<CardTitle class="mb-2 text-xl">Not Logged In</CardTitle>
				<CardDescription>Please log in to view your profile</CardDescription>
				<Button class="mt-4" onclick={() => (window.location.href = '/login')}>Login</Button>
			</CardContent>
		</Card>
	{:else}
		<Card>
			<CardHeader>
				<CardTitle>Personal Information</CardTitle>
				<CardDescription>Update your profile information below.</CardDescription>
			</CardHeader>
			<CardContent>
				<form onsubmit={handleSubmit} class="space-y-6">
					{#if message}
						<div
							class="p-3 text-sm {messageType === 'success'
								? 'border border-green-200 bg-green-50 text-green-600'
								: 'border border-red-200 bg-red-50 text-red-600'} rounded-md"
						>
							{message}
						</div>
					{/if}

					<!-- Email (read-only) -->
					<div class="space-y-2">
						<Label for="email" class="flex items-center gap-2">
							Email
							<Lock class="h-3 w-3 text-gray-500" />
						</Label>
						<Input
							id="email"
							type="email"
							bind:value={email}
							placeholder="Your email address"
							readonly
							class="cursor-not-allowed bg-gray-50 text-gray-600"
						/>
					</div>

					<!-- Profile Type (read-only) -->
					<div class="space-y-2">
						<Label for="profile_type" class="flex items-center gap-2">
							Profile Type
							<Lock class="h-3 w-3 text-gray-500" />
						</Label>
						<Input
							id="profile_type"
							type="text"
							bind:value={profile_type}
							readonly
							class="cursor-not-allowed bg-gray-50 text-gray-600"
						/>
					</div>

					<!-- Full Name -->
					<div class="space-y-2">
						<Label for="full_name">Full Name *</Label>
						<Input
							id="full_name"
							type="text"
							bind:value={full_name}
							placeholder="Enter your full name"
							maxlength={100}
							pattern="[a-zA-Z\s'-]+"
							title="Full name can only contain letters, spaces, apostrophes, and hyphens"
							required
						/>
					</div>

					<!-- Gender -->
					<div class="space-y-2">
						<Label for="gender">Gender *</Label>
						<Select.Root type="single" name="gender" bind:value={gender}>
							<Select.Trigger class="w-full">
								{genderContent}
							</Select.Trigger>
							<Select.Content>
								<Select.Group>
									<Select.Item value="Male" label="Male">Male</Select.Item>
									<Select.Item value="Female" label="Female">Female</Select.Item>
									<Select.Item value="Other" label="Prefer not to say">Prefer not to say</Select.Item>
								</Select.Group>
							</Select.Content>
						</Select.Root>
					</div>

					{#if isStudent}
						<!-- Student ID -->
						<div class="space-y-2">
							<Label for="student_id">Student ID *</Label>
							<Input
								id="student_id"
								type="text"
								bind:value={student_id}
								placeholder="Enter your student ID"
								maxlength={10}
								pattern="[0-9]*"
								title="Student ID must contain only numbers"
								required
							/>
						</div>

						<!-- Study Level -->
						<div class="space-y-2">
							<Label for="study_level">Study Level *</Label>
							<Select.Root type="single" name="study_level" bind:value={study_level_id}>
								<Select.Trigger class="w-full">
									{studyLevelContent}
								</Select.Trigger>
								<Select.Content>
									<Select.Group>
										{#each studyLevels as level}
											<Select.Item value={level.study_level_id || ''} label={level.name}>
												{level.name}
											</Select.Item>
										{/each}
									</Select.Group>
								</Select.Content>
							</Select.Root>
						</div>

						<!-- Study School and Program -->
						<div class="space-y-2">
							<Label for="study_school">Study School *</Label>
							<Select.Root type="single" name="study_school" bind:value={study_school_id}>
								<Select.Trigger class="w-full">
									{studySchoolContent}
								</Select.Trigger>
								<Select.Content>
									<Select.Group>
										{#if studySchools.length === 0}
											<Select.Item value="" label="No schools available" disabled>
												No schools available
											</Select.Item>
										{:else}
											{#each studySchools as school}
												<Select.Item value={school.study_school_id || ''} label={school.name}>
													{school.name}
												</Select.Item>
											{/each}
										{/if}
									</Select.Group>
								</Select.Content>
							</Select.Root>
						</div>

						<div class="space-y-2">
							<Label for="study_program">{studyProgramLabel}</Label>
							<Select.Root
								type="single"
								name="study_program"
								bind:value={study_program_id}
								disabled={!study_level_id || !study_school_id || availablePrograms.length === 0}
							>
								<Select.Trigger class="w-full">
									{studyProgramContent}
								</Select.Trigger>
								<Select.Content>
									<Select.Group>
										{#if availablePrograms.length === 0}
											<Select.Item value="" label="Select level and school first" disabled>
												{study_level_id && study_school_id
													? 'No programs available for this combination'
													: 'Select level and school first'}
											</Select.Item>
										{:else}
											{#each availablePrograms as program}
												<Select.Item
													value={program.study_program_id}
													label={program.study_course?.name || 'Unknown Program'}
												>
													{program.study_course?.name || 'Unknown Program'}
												</Select.Item>
											{/each}
										{/if}
									</Select.Group>
								</Select.Content>
							</Select.Root>
						</div>

						<!-- Enrolment Year -->
						<div class="space-y-2">
							<Label for="enrolment_year">Enrolment Year *</Label>
							<Input
								id="enrolment_year"
								type="text"
								bind:value={enrolment_year}
								placeholder="Enter your enrolment year"
								maxlength={4}
								title="Enrolment year must be exactly 4 digits"
								required
							/>
						</div>

						<!-- Enrolment Intake -->
						<div class="space-y-2">
							<Label for="enrolment_intake">Enrolment Intake *</Label>
							<Select.Root type="single" name="enrolment_intake" bind:value={enrolment_intake}>
								<Select.Trigger class="w-full">
									{enrolmentIntakeContent}
								</Select.Trigger>
								<Select.Content>
									<Select.Group>
										<Select.Item value="2" label="February">February</Select.Item>
										<Select.Item value="7" label="July">July</Select.Item>
										<Select.Item value="10" label="October">October</Select.Item>
									</Select.Group>
								</Select.Content>
							</Select.Root>
						</div>
					{/if}

					<!-- Submit Button -->
					<div class="flex justify-end space-x-2 pt-4">
						<!-- <Button type="button" variant="outline" onclick={() => window.history.back()}>
							Cancel
						</Button> -->
						<!-- <Button type="submit" disabled={saving}>
							{#if saving}
								<div class="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current"></div>
								Saving Changes...
							{:else}
								Save Changes
							{/if}
						</Button> -->
						<Button
							type="button"
							disabled={requesting || !!pendingRequest || !hasChanges}
							onclick={handleRequestUpdate}
						>
							{#if requesting}
								<div class="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current"></div>
								Requesting Update...
							{:else if pendingRequest}
								Request Pending
							{:else if !hasChanges}
								Request Update
							{:else}
								Request Update
							{/if}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	{/if}
</div>
