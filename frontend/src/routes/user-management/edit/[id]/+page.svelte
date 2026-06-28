<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		getAllUsers,
		updateUserProfile,
		getStudyLevels,
		getStudySchools,
		getStudyProgramsBySchoolAndLevel,
		updateUserRole,
		getProfileRoles
	} from '$lib/database';
	import { getUserProfile } from '$lib/auth';
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
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import {
		AlertDialog,
		AlertDialogAction,
		AlertDialogCancel,
		AlertDialogContent,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogHeader,
		AlertDialogTitle,
		AlertDialogTrigger
	} from '$lib/components/ui/alert-dialog/index.js';
	import { toast } from 'svelte-sonner';
	import { ArrowLeft, User, Shield, Users, ShieldCheck, UserX } from '@lucide/svelte';
	import type { Profile, StudyLevel, StudySchool, ProfileRole, ProfileType } from '$lib/types';

	let { data } = $props();
	let { supabase } = $derived(data);

	let profileId = $state('');
	let formData = $state({
		full_name: '',
		email: '',
		student_id: '',
		gender: '',
		enrolment_year: '',
		enrolment_intake: '',
		study_level_id: '',
		study_school_id: '',
		study_program_id: ''
	});
	let loading = $state(true);
	let saving = $state(false);
	let isUpdatingRole = $state(false);
	let userProfile: any = $state(null);
	let targetUser: Profile | null = $state(null);
	let errors: Record<string, string> = $state({});
	let selectedRoleId = $state('');

	// Dropdown data
	let studyLevels: StudyLevel[] = $state([]);
	let studySchools: StudySchool[] = $state([]);
	let studyPrograms: any[] = $state([]);
	let profileRoles: ProfileRole[] = $state([]);
	let loadingPrograms = $state(false);

	onMount(async () => {
		profileId = $page.params?.id || '';
		await loadData();
	});

	async function loadData() {
		loading = true;
		try {
			const [profile, users, levels, schools, roles] = await Promise.all([
				getUserProfile(supabase),
				getAllUsers(supabase),
				getStudyLevels(supabase),
				getStudySchools(supabase),
				getProfileRoles(supabase)
			]);

			userProfile = profile;
			studyLevels = levels;
			studySchools = schools;
			profileRoles = roles;
			targetUser = users.find((user) => user.profile_id === profileId) || null;

			if (targetUser) {
				// Store program info for later assignment
				let targetLevelId = '';
				let targetSchoolId = '';
				let targetProgramId = '';

				// Set the selected role ID for the dropdown
				selectedRoleId = targetUser.profile_role_id || '';

				// Populate basic form data first
				formData = {
					full_name: targetUser.full_name || '',
					email: targetUser.email || '',
					student_id: targetUser.student_id?.toString() || '',
					gender: targetUser.gender || '',
					enrolment_year: targetUser.enrolment_year?.toString() || '',
					enrolment_intake: targetUser.enrolment_intake?.toString() || '',
					study_level_id: '',
					study_school_id: '',
					study_program_id: ''
				};

				// Extract program information from existing data
				if (targetUser.study_program) {
					targetLevelId = targetUser.study_program.study_level_id || '';
					targetSchoolId = targetUser.study_program.study_school_id || '';
					targetProgramId = targetUser.study_program.study_program_id || '';
				}

				console.log('Target user data:', {
					targetUser: targetUser,
					study_program: targetUser.study_program,
					targetLevelId,
					targetSchoolId,
					targetProgramId
				});

				// Now set level, school and program after reference data is loaded
				if (targetLevelId && targetSchoolId) {
					formData.study_level_id = targetLevelId;
					formData.study_school_id = targetSchoolId;

					// Load programs for the existing level and school selection
					await loadStudyPrograms(targetLevelId, targetSchoolId);

					// Set program after programs are loaded
					if (targetProgramId) {
						formData.study_program_id = targetProgramId;
					}
				}

				console.log('Loaded user data:', {
					studyLevels: studyLevels.length,
					studySchools: studySchools.length,
					study_level_id: formData.study_level_id,
					study_school_id: formData.study_school_id,
					study_program_id: formData.study_program_id,
					studyPrograms: studyPrograms.length
				});
			} else {
				// User not found, redirect back
				goto('/user-management');
				return;
			}
		} catch (error) {
			console.error('Error loading data:', error);
			goto('/user-management');
		} finally {
			loading = false;
		}
	}

	async function loadStudyPrograms(levelId: string, schoolId: string) {
		if (!levelId || !schoolId) {
			studyPrograms = [];
			return;
		}

		loadingPrograms = true;
		try {
			const programs = await getStudyProgramsBySchoolAndLevel(supabase, levelId, schoolId);
			studyPrograms = programs;
		} catch (error) {
			console.error('Error loading study programs:', error);
			studyPrograms = [];
		} finally {
			loadingPrograms = false;
		}
	}

	async function handleLevelOrSchoolChange() {
		if (formData.study_level_id && formData.study_school_id) {
			// Reset program selection when level or school changes
			formData.study_program_id = '';
			await loadStudyPrograms(formData.study_level_id, formData.study_school_id);
		} else {
			studyPrograms = [];
			formData.study_program_id = '';
		}
	}
	function validateForm() {
		const newErrors: Record<string, string> = {};

		if (!formData.full_name.trim()) {
			newErrors.full_name = 'Full name is required';
		} else if (formData.full_name.trim().length < 2) {
			newErrors.full_name = 'Full name must be at least 2 characters';
		}

		if (!formData.email.trim()) {
			newErrors.email = 'Email is required';
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
			newErrors.email = 'Please enter a valid email address';
		}

		if (!formData.gender.trim()) {
			newErrors.gender = 'Gender is required';
		}

		// Only validate student-specific fields if the user is a student
		if (isUserStudent(targetUser)) {
			// Validate student ID format if provided
			if (formData.student_id.trim() && !/^\d+$/.test(formData.student_id.trim())) {
				newErrors.student_id = 'Student ID must be a number';
			}

			// Validate enrolment year format if provided
			if (formData.enrolment_year.trim()) {
				const year = parseInt(formData.enrolment_year.trim());
				const currentYear = new Date().getFullYear();
				if (year < 2000 || year > currentYear + 1) {
					newErrors.enrolment_year = `Enrolment year must be between 2000 and ${currentYear + 1}`;
				}
			}

			// Validate enrolment intake format if provided
			if (
				formData.enrolment_intake.trim() &&
				!['2', '7', '10'].includes(formData.enrolment_intake.trim())
			) {
				newErrors.enrolment_intake =
					'Enrolment intake must be February (2), July (7), or October (10)';
			}
		}

		errors = newErrors;
		return Object.keys(newErrors).length === 0;
	}

	async function handleSubmit() {
		if (!validateForm() || !userProfile?.profile?.profile_id || !targetUser) return;

		saving = true;
		try {
			const updateData: Partial<Profile> = {
				full_name: formData.full_name.trim() || undefined,
				email: formData.email.trim() || undefined,
				gender: formData.gender || undefined
			};

			// Only include student-specific fields if the user is a student
			if (isUserStudent(targetUser)) {
				updateData.student_id = formData.student_id ? parseInt(formData.student_id) : undefined;
				updateData.enrolment_year = formData.enrolment_year
					? parseInt(formData.enrolment_year)
					: undefined;
				updateData.enrolment_intake = formData.enrolment_intake
					? parseInt(formData.enrolment_intake)
					: undefined;
				updateData.study_program_id = formData.study_program_id || undefined;
			}

			const result = await updateUserProfile(supabase, targetUser.profile_id, updateData);

			if (result) {
				goto('/user-management');
			} else {
				toast('Failed to update user. Please try again.');
			}
		} catch (error) {
			console.error('Error updating user:', error);
			toast('An error occurred while updating the user.');
		} finally {
			saving = false;
		}
	}

	function handleCancel() {
		goto('/user-management');
	}

	async function handleUpdateRole(newRoleId: string) {
		if (!userProfile?.profile?.profile_id || !targetUser || !newRoleId) return;

		isUpdatingRole = true;
		try {
			const success = await updateUserRole(supabase,
				targetUser.profile_id,
				newRoleId,
				userProfile.profile.profile_id
			);

			if (success) {
				// Find the new role and update the target user locally
				const newRole = profileRoles.find((role) => role.profile_role_id === newRoleId);
				if (newRole) {
					targetUser = {
						...targetUser,
						profile_role_id: newRoleId,
						profile_role: newRole
					};
					selectedRoleId = newRoleId;
					toast(`User role updated to ${newRole.name} successfully.`);
				}
			} else {
				toast('Failed to update user role. Please try again.');
			}
		} catch (error) {
			console.error('Error updating user role:', error);
			toast('An error occurred while updating the user role.');
		} finally {
			isUpdatingRole = false;
		}
	}

	function handleInputChange(field: string, value: string) {
		formData[field as keyof typeof formData] = value;

		// Clear error when user starts typing
		if (errors[field]) {
			const newErrors = { ...errors };
			delete newErrors[field];
			errors = newErrors;
		}
	}

	// Handle school selection changes for the UI

	function getUserRole(user: Profile) {
		return user.profile_role?.name || 'User';
	}

	function isUserAdmin(user: Profile) {
		const roleName = user.profile_role?.name;
		return roleName === 'Admin' || roleName === 'Superadmin';
	}

	function getUserDisplayName(user: Profile | null) {
		return user?.full_name || 'Unknown User';
	}

	function isUserStudent(user: Profile | null) {
		// If profile_type is available, use it
		if (user?.profile_type?.name) {
			return user.profile_type.name === 'Student';
		}

		// Fallback: check if user has student-specific data
		if (user?.student_id || user?.study_program_id || user?.enrolment_year) {
			return true;
		}

		// Fallback: check email pattern (students typically have @student.monash.edu)
		if (user?.email?.includes('@student.')) {
			return true;
		}

		// Default to false for safety
		return false;
	}
</script>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<div class="mb-6">
		<Button variant="ghost" onclick={handleCancel} class="mb-4 flex items-center gap-2">
			<ArrowLeft class="h-4 w-4" />
			Back to Users
		</Button>

		<div class="flex items-center gap-3">
			<User class="h-8 w-8 text-blue-600" />
			<div>
				<h1 class="text-3xl font-bold text-gray-900">Edit User</h1>
				<p class="mt-1 flex items-center gap-2 text-gray-600">
					{#if targetUser}
						Editing "{getUserDisplayName(targetUser)}"
						<Badge variant={isUserStudent(targetUser) ? 'default' : 'secondary'} class="ml-2">
							{targetUser.profile_type?.name ||
								(isUserStudent(targetUser) ? 'Student' : 'Staff/External')}
						</Badge>
					{:else}
						Loading user details...
					{/if}
				</p>
			</div>
		</div>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
			<span class="ml-2">Loading user...</span>
		</div>
	{:else if targetUser}
		<div class="space-y-6">
			<!-- Basic Information -->
			<Card>
				<CardHeader>
					<CardTitle>Basic Information</CardTitle>
					<CardDescription>Update the user's basic profile information.</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						onsubmit={(e) => {
							e.preventDefault();
							handleSubmit();
						}}
						class="space-y-6"
					>
						<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
							<div class="space-y-2">
								<Label for="full_name">Full Name *</Label>
								<Input
									id="full_name"
									type="text"
									placeholder="Enter full name"
									value={formData.full_name}
									oninput={(e) =>
										handleInputChange('full_name', (e.target as HTMLInputElement).value)}
									class={errors.full_name ? 'border-red-500' : ''}
									disabled={saving}
								/>
								{#if errors.full_name}
									<p class="text-sm text-red-600">{errors.full_name}</p>
								{/if}
							</div>

							<div class="space-y-2">
								<Label for="email">Email</Label>
								<Input
									id="email"
									type="email"
									placeholder="Enter email address"
									value={formData.email}
									class={errors.email ? 'border-red-500' : ''}
									disabled={true}
									readonly
								/>
								{#if errors.email}
									<p class="text-sm text-red-600">{errors.email}</p>
								{/if}
							</div>

							<div class="space-y-2 md:col-span-1">
								<Label for="gender">Gender *</Label>
								<Select.Root
									type="single"
									value={formData.gender}
									onValueChange={(value) => {
										if (value !== undefined) {
											formData.gender = value;
											// Clear error when user selects
											if (errors.gender) {
												const newErrors = { ...errors };
												delete newErrors.gender;
												errors = newErrors;
											}
										}
									}}
								>
									<Select.Trigger class={`w-full ${errors.gender ? 'border-red-500' : ''}`}>
										{formData.gender === 'Other' ? 'Prefer not to say' : formData.gender || 'Select gender'}
									</Select.Trigger>
									<Select.Content>
										<Select.Group>
											<Select.Item value="Male" label="Male">Male</Select.Item>
											<Select.Item value="Female" label="Female">Female</Select.Item>
											<Select.Item value="Other" label="Prefer not to say">Prefer not to say</Select.Item>
										</Select.Group>
									</Select.Content>
								</Select.Root>
								{#if errors.gender}
									<p class="text-sm text-red-600">{errors.gender}</p>
								{/if}
							</div>
						</div>
					</form>
				</CardContent>
			</Card>

			<!-- Study Information - Only show for students -->
			{#if isUserStudent(targetUser)}
				<Card>
					<CardHeader>
						<CardTitle>Study Information</CardTitle>
						<CardDescription
							>Update the user's academic details. This section is only available for student
							profiles.</CardDescription
						>
					</CardHeader>
					<CardContent>
						<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
							<div class="space-y-2">
								<Label for="student_id">Student ID</Label>
								<Input
									id="student_id"
									type="text"
									placeholder="Enter student ID"
									value={formData.student_id}
									oninput={(e) =>
										handleInputChange('student_id', (e.target as HTMLInputElement).value)}
									class={errors.student_id ? 'border-red-500' : ''}
									disabled={saving}
								/>
								{#if errors.student_id}
									<p class="text-sm text-red-600">{errors.student_id}</p>
								{/if}
							</div>

							<div class="space-y-2">
								<Label for="study_level_id">Study Level</Label>
								<Select.Root
									type="single"
									value={formData.study_level_id}
									onValueChange={(value) => {
										if (value !== undefined) {
											formData.study_level_id = value;
											// Clear error when user selects
											if (errors.study_level_id) {
												const newErrors = { ...errors };
												delete newErrors.study_level_id;
												errors = newErrors;
											}
											handleLevelOrSchoolChange();
										}
									}}
								>
									<Select.Trigger class={`w-full ${errors.study_level_id ? 'border-red-500' : ''}`}>
										{formData.study_level_id
											? studyLevels.find((l) => l.study_level_id === formData.study_level_id)
													?.name || 'Select study level'
											: 'Select study level'}
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
								{#if errors.study_level_id}
									<p class="text-sm text-red-600">{errors.study_level_id}</p>
								{/if}
							</div>

							<div class="space-y-2">
								<Label for="study_school_id">Study School</Label>
								<Select.Root
									type="single"
									value={formData.study_school_id}
									onValueChange={(value) => {
										if (value !== undefined) {
											formData.study_school_id = value;
											// Clear error when user selects
											if (errors.study_school_id) {
												const newErrors = { ...errors };
												delete newErrors.study_school_id;
												errors = newErrors;
											}
											handleLevelOrSchoolChange();
										}
									}}
								>
									<Select.Trigger
										class={`w-full ${errors.study_school_id ? 'border-red-500' : ''}`}
									>
										{formData.study_school_id
											? studySchools.find((s) => s.study_school_id === formData.study_school_id)
													?.name || 'Select study school'
											: 'Select study school'}
									</Select.Trigger>
									<Select.Content>
										<Select.Group>
											{#each studySchools as school}
												<Select.Item value={school.study_school_id || ''} label={school.name}>
													{school.name}
												</Select.Item>
											{/each}
										</Select.Group>
									</Select.Content>
								</Select.Root>
								{#if errors.study_school_id}
									<p class="text-sm text-red-600">{errors.study_school_id}</p>
								{/if}
							</div>

							<div class="space-y-2">
								<Label for="study_program_id">Study Program</Label>
								<Select.Root
									type="single"
									value={formData.study_program_id}
									onValueChange={(value) => {
										if (value !== undefined) {
											formData.study_program_id = value;
											// Clear error when user selects
											if (errors.study_program_id) {
												const newErrors = { ...errors };
												delete newErrors.study_program_id;
												errors = newErrors;
											}
										}
									}}
									disabled={!formData.study_level_id ||
										!formData.study_school_id ||
										loadingPrograms}
								>
									<Select.Trigger
										class={`w-full ${errors.study_program_id ? 'border-red-500' : ''}`}
									>
										{#if !formData.study_level_id || !formData.study_school_id}
											Select level and school first
										{:else if loadingPrograms}
											Loading programs...
										{:else if studyPrograms.length === 0}
											No programs available for this combination
										{:else if formData.study_program_id}
											{studyPrograms.find((p) => p.study_program_id === formData.study_program_id)
												?.study_course?.name || 'Select study program'}
										{:else}
											Select study program
										{/if}
									</Select.Trigger>
									<Select.Content>
										<Select.Group>
											{#each studyPrograms as program}
												<Select.Item
													value={program.study_program_id}
													label={program.study_course?.name || 'Unknown Program'}
												>
													{program.study_course?.name || 'Unknown Program'}
												</Select.Item>
											{/each}
										</Select.Group>
									</Select.Content>
								</Select.Root>
								{#if errors.study_program_id}
									<p class="text-sm text-red-600">{errors.study_program_id}</p>
								{/if}
							</div>

							<div class="space-y-2">
								<Label for="enrolment_year">Enrolment Year</Label>
								<Input
									id="enrolment_year"
									type="text"
									placeholder={`Enter enrolment year (e.g., ${new Date().getFullYear()})`}
									value={formData.enrolment_year}
									oninput={(e) =>
										handleInputChange('enrolment_year', (e.target as HTMLInputElement).value)}
									class={errors.enrolment_year ? 'border-red-500' : ''}
									disabled={saving}
								/>
								{#if errors.enrolment_year}
									<p class="text-sm text-red-600">{errors.enrolment_year}</p>
								{/if}
							</div>

							<div class="space-y-2">
								<Label for="enrolment_intake">Enrolment Intake</Label>
								<Select.Root
									type="single"
									value={formData.enrolment_intake}
									onValueChange={(value) => {
										if (value !== undefined) {
											formData.enrolment_intake = value;
											// Clear error when user selects
											if (errors.enrolment_intake) {
												const newErrors = { ...errors };
												delete newErrors.enrolment_intake;
												errors = newErrors;
											}
										}
									}}
								>
									<Select.Trigger
										class={`w-full ${errors.enrolment_intake ? 'border-red-500' : ''}`}
									>
										{formData.enrolment_intake === '2'
											? 'February'
											: formData.enrolment_intake === '7'
												? 'July'
												: formData.enrolment_intake === '10'
													? 'October'
													: 'Select enrolment intake'}
									</Select.Trigger>
									<Select.Content>
										<Select.Group>
											<Select.Item value="2" label="February">February</Select.Item>
											<Select.Item value="7" label="July">July</Select.Item>
											<Select.Item value="10" label="October">October</Select.Item>
										</Select.Group>
									</Select.Content>
								</Select.Root>
								{#if errors.enrolment_intake}
									<p class="text-sm text-red-600">{errors.enrolment_intake}</p>
								{/if}
							</div>
						</div>
					</CardContent>
				</Card>
			{/if}

			<!-- Role Management -->
			<Card>
				<CardHeader>
					<CardTitle class="flex items-center gap-2">Role Management</CardTitle>
					<CardDescription>Manage the user's role and permissions in the system.</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="space-y-4">
						<!-- <div class="flex items-center justify-between rounded-lg border p-4">
							<div class="flex items-center gap-3">
								<Badge
									variant={isUserAdmin(targetUser) ? 'destructive' : 'secondary'}
									class="text-sm"
								>
									{#if isUserAdmin(targetUser)}
										<Shield class="mr-2 h-4 w-4" />
										{getUserRole(targetUser)}
									{:else}
										<Users class="mr-2 h-4 w-4" />
										{getUserRole(targetUser)}
									{/if}
								</Badge>
								<div>
									<p class="font-medium">Current Role: {getUserRole(targetUser)}</p>
									<p class="text-sm text-gray-600">
										{isUserAdmin(targetUser)
											? 'This user has administrative privileges'
											: 'This user has standard privileges'}
									</p>
								</div>
							</div>
						</div> -->

						<div class="space-y-2">
							<Label for="role-select">Change Role</Label>
							<div class="flex gap-2">
								<Select.Root
									type="single"
									value={selectedRoleId}
									onValueChange={(value) => {
										if (value !== undefined) selectedRoleId = value;
									}}
								>
									<Select.Trigger class="flex-1">
										{profileRoles.find((role) => role.profile_role_id === selectedRoleId)?.name ||
											'Select role'}
									</Select.Trigger>
									<Select.Content>
										<Select.Group>
											{#each profileRoles as role}
												<Select.Item value={role.profile_role_id} label={role.name}>
													{role.name}
												</Select.Item>
											{/each}
										</Select.Group>
									</Select.Content>
								</Select.Root>
								<Button
									variant="outline"
									onclick={() => handleUpdateRole(selectedRoleId)}
									disabled={isUpdatingRole ||
										selectedRoleId === targetUser.profile_role_id ||
										!selectedRoleId}
									class="flex items-center gap-2"
								>
									{#if isUpdatingRole}
										<div class="h-4 w-4 animate-spin rounded-full border-b-2 border-gray-900"></div>
									{:else}
										<ShieldCheck class="h-4 w-4" />
									{/if}
									Update Role
								</Button>
							</div>
							<p class="text-xs text-gray-500">
								Select a new role and click "Update Role" to change the user's permissions.
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			<!-- Action Buttons -->
			<Card>
				<CardContent class="pt-6">
					<div class="flex justify-end gap-4">
						<Button type="button" variant="outline" onclick={handleCancel} disabled={saving}>
							Cancel
						</Button>
						<Button
							type="button"
							onclick={handleSubmit}
							disabled={saving || !formData.full_name.trim() || !formData.gender.trim()}
							class="flex items-center gap-2"
						>
							{#if saving}
								<div class="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
							{/if}
							Update User
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	{:else}
		<Card>
			<CardContent class="py-8 text-center">
				<p class="text-gray-600">User not found.</p>
				<Button onclick={handleCancel} class="mt-4">Back to Users</Button>
			</CardContent>
		</Card>
	{/if}
</div>
