<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getCurrentUser, signOut } from '$lib/auth';
	import { LogOut } from '@lucide/svelte';
	import {
		createUserProfile,
		getStudyLevels,
		getStudySchools,
		getStudyProgramsBySchoolAndLevel,
		getUserProfile,
		getProfileRoleByName,
		getProfileTypeByName
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
	import type { StudyLevel, StudySchool } from '$lib/types';

	let { data } = $props();
	let { supabase } = $derived(data);

	let currentUser: any = null;
	let loading = $state(true);
	let saving = $state(false);
	let error = $state<string | null>(null);

	// Form data using $state for better reactivity
	let email = $state('');
	let full_name = $state('');
	let student_id = $state('');
	let gender = $state('');
	let enrolment_year = $state('');
	let enrolment_intake = $state('');
	let study_level_id = $state('');
	let study_school_id = $state('');
	let study_program_id = $state('');
	let profile_type = $state(''); // Auto-inferred from email

	// Reference data
	let studyLevels = $state<StudyLevel[]>([]);
	let studySchools = $state<StudySchool[]>([]);
	let availablePrograms = $state<any[]>([]); // Study programs available for selected level and school

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

	const profileTypeContent = $derived(profile_type || 'Determining...');

	const studyProgramLabel = $derived(
		availablePrograms.length > 0 ? 'Study Program *' : 'Study Program'
	);

	// Computed variable to check if user is a student
	const isStudent = $derived(profile_type === 'Student');

	onMount(async () => {
		await loadData();
	});

	// Watch for level and school selection changes using $effect
	$effect(() => {
		if (study_level_id && study_school_id) {
			loadProgramsForLevelAndSchool(study_level_id, study_school_id);
			// Reset program selection when level or school changes
			study_program_id = '';
		} else {
			availablePrograms = [];
			study_program_id = '';
		}
	});

	async function loadData() {
		try {
			loading = true;

			// Get current user
			currentUser = await getCurrentUser(supabase);
			if (!currentUser) {
				goto('/');
				return;
			}

			// Check if user already has a profile - if so, redirect to events
			console.log('Checking for existing profile for user:', currentUser.id);
			const existingProfile = await getUserProfile(supabase, currentUser.id);
			console.log('Existing profile result:', existingProfile);
			if (existingProfile) {
				console.log('User already has a profile, redirecting to events');
				goto('/events');
				return;
			}
			console.log('No existing profile found, proceeding with registration form');

			// Pre-populate form with user data
			email = currentUser.email || '';
			full_name =
				currentUser.user_metadata?.full_name ||
				currentUser.user_metadata?.name ||
				currentUser.email?.split('@')[0] ||
				'';

			// Infer profile type from email
			if (email.includes('@student.monash.edu')) {
				profile_type = 'Student';
			} else if (email.includes('@monash.edu')) {
				profile_type = 'Staff';
			} else {
				profile_type = 'External';
			}

			// Load reference data
			const [levels, schools] = await Promise.all([getStudyLevels(supabase), getStudySchools(supabase)]);

			studyLevels = levels;
			studySchools = schools;

			console.log('Loaded data:', {
				studyLevels: studyLevels.length,
				studySchools: studySchools.length
			});
		} catch (err) {
			console.error('Error loading data:', err);
			error = 'Failed to load registration form.';
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

	async function handleSubmit(event: Event) {
		event.preventDefault();

		try {
			saving = true;
			error = null;

			// Validate required fields
			if (!full_name.trim()) {
				error = 'Full name is required.';
				return;
			}

			// Validate full name format (only letters, spaces, apostrophes, hyphens)
			if (!/^[a-zA-Z\s'-]+$/.test(full_name.trim())) {
				error = 'Full name can only contain letters, spaces, and punctuation.';
				return;
			}

			// Validate full name length
			if (full_name.trim().length < 2) {
				error = 'Full name must be at least 2 characters.';
				return;
			}

			if (full_name.trim().length > 100) {
				error = 'Full name is too long.';
				return;
			}

			if (!gender) {
				error = 'Gender is required.';
				return;
			}

			// Validate student-specific fields only for students
			if (isStudent) {
				if (!student_id.trim()) {
					error = 'Student ID is required.';
					return;
				}

				// Validate student ID format (numerical, max 10 digits)
				const studentIdNum = student_id.trim();
				if (!/^\d+$/.test(studentIdNum)) {
					error = 'Student ID must contain only numbers.';
					return;
				}

				if (studentIdNum.length > 10) {
					error = 'Student ID is too long.';
					return;
				}

				if (studentIdNum.length < 1) {
					error = 'Student ID is required.';
					return;
				}

				if (!enrolment_year.trim()) {
					error = 'Enrolment year is required.';
					return;
				}

				// Validate enrolment year format (exactly 4 digits)
				const enrolmentYearNum = enrolment_year.trim();

				// Check if it's a valid number and exactly 4 digits
				if (!/^\d{4}$/.test(enrolmentYearNum)) {
					if (enrolmentYearNum.length !== 4) {
						error = 'Enrolment year must be 4 digits.';
					} else {
						error = 'Enrolment year must contain only numbers.';
					}
					return;
				}

				// Validate enrolment year range (reasonable range)
				const currentYear = new Date().getFullYear();
				const yearNum = parseInt(enrolmentYearNum, 10);
				if (isNaN(yearNum) || yearNum < 1900 || yearNum > currentYear + 5) {
					error = 'Please enter a valid year.';
					return;
				}

				if (!enrolment_intake) {
					error = 'Enrolment intake is required.';
					return;
				}

				if (!study_level_id) {
					error = 'Study level is required.';
					return;
				}

				if (!study_school_id) {
					error = 'Study school is required.';
					return;
				}

				// Study program is only required if there are available programs for the level/school combination
				if (availablePrograms.length > 0 && !study_program_id) {
					error = 'Study program is required.';
					return;
				}
			}

			// Get the 'User' profile role
			const userProfileRole = await getProfileRoleByName(supabase, 'User');
			if (!userProfileRole) {
				error = 'Failed to assign user role.';
				return;
			}

			// Note: Profile type functionality is now enabled
			// Get the profile type
			const profileType = await getProfileTypeByName(supabase, profile_type);
			if (!profileType) {
				error = 'Failed to determine profile type. Please try again.';
				return;
			}

			// Create user profile
			const profile = await createUserProfile(supabase, {
				user_id: currentUser.id,
				email: currentUser.email,
				full_name: full_name.trim(),
				student_id: isStudent ? parseInt(student_id) : undefined,
				gender: gender || undefined,
				enrolment_year: isStudent ? parseInt(enrolment_year.trim()) : undefined,
				enrolment_intake: isStudent ? parseInt(enrolment_intake) : undefined,
				study_program_id: isStudent ? study_program_id : undefined,
				profile_role_id: userProfileRole.profile_role_id,
				profile_type_id: profileType.profile_type_id,
				created_by: currentUser.id
			});

			if (!profile) {
				error = 'Failed to create profile.';
				return;
			}

			// Successfully registered, redirect to events
			goto('/events');
		} catch (err) {
			console.error('Error creating profile:', err);
			error = 'Registration failed. Please try again.';
		} finally {
			saving = false;
		}
	}

	async function logout() {
		try {
			await signOut(supabase);
			goto('/');
		} catch (error) {
			console.error('Error during logout:', error);
			goto('/');
		}
	}
</script>

<svelte:head>
	<title>Complete Registration - SEMS</title>
	<meta
		name="description"
		content="Complete your student profile registration to access events and activities on the SEMS platform."
	/>
	<meta name="keywords" content="student registration, profile setup, SEMS registration" />
	<meta property="og:title" content="Complete Registration - SEMS" />
	<meta
		property="og:description"
		content="Complete your student profile registration to access events and activities on the SEMS platform."
	/>
	<meta property="og:type" content="website" />
	<meta name="robots" content="noindex, nofollow" />
	<link rel="canonical" href="/register" />
</svelte:head>

<!-- Simplified Navbar -->
<nav class="bg-primary text-primary-foreground fixed left-0 right-0 top-0 z-50 border-b shadow-lg">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex h-16 items-center justify-between">
			<!-- Logo (non-clickable) -->
			<div class="flex items-center sm:px-5">
				<div class="flex items-center space-x-2">
					<img src="/logo.png" alt="Logo" class="h-8 w-auto object-contain" />
				</div>
			</div>

			<!-- Logout Button -->
			<Button
				variant="ghost"
				class="text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10 flex items-center gap-2"
				onclick={logout}
			>
				<LogOut class="h-4 w-4" />
				<span class="hidden sm:inline">Logout</span>
			</Button>
		</div>
	</div>
</nav>

<div class="relative flex min-h-screen items-center justify-center overflow-hidden py-8 pt-24">
	<!-- Background -->
	<div
		class="absolute inset-0 bg-cover bg-center bg-no-repeat"
		style="background-image: url('/landing.jpg'); filter: blur(2px);"
	></div>

	<!-- Overlay -->
	<div class="absolute inset-0 bg-black/30"></div>

	<!-- Content -->
	<div class="relative z-10 mx-4 w-full max-w-2xl">
		<Card class="bg-white/95 shadow-2xl backdrop-blur-sm">
			<CardHeader class="text-center">
				<CardTitle class="text-3xl font-bold">Complete Your Registration</CardTitle>
				<CardDescription class="text-gray-600">
					Please provide your details to complete your account setup
				</CardDescription>
			</CardHeader>
			<CardContent>
				{#if loading}
					<div class="flex items-center justify-center py-8">
						<div class="border-primary h-8 w-8 animate-spin rounded-full border-b-2"></div>
					</div>
				{:else}
					<form onsubmit={handleSubmit} class="space-y-6">
						{#if error}
							<div class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
								{error}
							</div>
						{/if}

						<!-- Email (read-only) -->
						<div class="space-y-2">
							<Label for="email">Email</Label>
							<Input
								id="email"
								type="email"
								bind:value={email}
								placeholder="Your email address"
								readonly
								class="cursor-not-allowed bg-gray-50 text-gray-600"
							/>
						</div>

						<!-- Profile Type (inferred, read-only) -->
						<div class="space-y-2">
							<div class="flex items-center gap-2">
								<Label for="profile_type">Profile Type</Label>
								<span
									class="cursor-help text-gray-500"
									title="Profile type is automatically determined from your email address. Students use @student.monash.edu, Staff use @monash.edu, and others are External. If incorrect, please log in with your preferred email."
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-4 w-4"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
										/>
									</svg>
								</span>
							</div>
							<Select.Root type="single" name="profile_type" bind:value={profile_type} disabled>
								<Select.Trigger class="w-full cursor-not-allowed bg-gray-50 text-gray-600">
									{profileTypeContent}
								</Select.Trigger>
								<Select.Content>
									<Select.Group>
										<Select.Item value="Student" label="Student">Student</Select.Item>
										<Select.Item value="Staff" label="Staff">Staff</Select.Item>
										<Select.Item value="External" label="External">External</Select.Item>
									</Select.Group>
								</Select.Content>
							</Select.Root>
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
												{#if level.study_level_id}
													<Select.Item value={level.study_level_id} label={level.name}>
														{level.name}
													</Select.Item>
												{/if}
											{/each}
										</Select.Group>
									</Select.Content>
								</Select.Root>
							</div>

							<!-- Study School and Course -->
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
													{#if school.study_school_id}
														<Select.Item value={school.study_school_id} label={school.name}>
															{school.name}
														</Select.Item>
													{/if}
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
						<Button type="submit" class="h-12 w-full text-lg font-semibold" disabled={saving}>
							{#if saving}
								<div class="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current"></div>
								Creating Profile...
							{:else}
								Complete Registration
							{/if}
						</Button>
					</form>
				{/if}
			</CardContent>
		</Card>
	</div>
</div>
