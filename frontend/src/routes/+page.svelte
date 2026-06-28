<script>
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import {
		Accordion,
		AccordionContent,
		AccordionItem,
		AccordionTrigger
	} from '$lib/components/ui/accordion/index.js';
	import * as HoverCard from '$lib/components/ui/hover-card/index.js';
	import { toast } from 'svelte-sonner';

	let { data } = $props();
	let { supabase } = $derived(data);

	function handleLogin() {
		goto('/');
	}

	function handleRegister() {
		goto('/events');
	}

	async function handleGoogleLogin() {
		try {
			const { error } = await supabase.auth.signInWithOAuth({
				provider: 'google',
				options: {
					redirectTo: `${window.location.origin}/callback`
				}
			});

			if (error) {
				console.error('Error logging in:', error.message);
				toast('Login failed: ' + error.message);
			}
		} catch (err) {
			console.error('Unexpected error:', err);
			toast('An unexpected error occurred');
		}
	}

	function scrollToAbout() {
		const aboutSection = document.querySelector('#about-section');
		if (aboutSection) {
			aboutSection.scrollIntoView({
				behavior: 'smooth',
				block: 'start'
			});
		}
	}
</script>

<svelte:head>
	<title>SEMS - Student Experience Management System</title>
	<meta
		name="description"
		content="Discover and join amazing student events! The Student Experience Management System connects students with engaging campus activities and experiences."
	/>
	<meta
		name="keywords"
		content="student events, campus activities, university events, student life, event management"
	/>
	<meta property="og:title" content="SEMS - Student Experience Management System" />
	<meta
		property="og:description"
		content="Discover and join amazing student events! Connect with engaging campus activities and experiences."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:image" content="/logo.png" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="SEMS - Student Experience Management System" />
	<meta
		name="twitter:description"
		content="Discover and join amazing student events! Connect with engaging campus activities and experiences."
	/>
	<meta name="twitter:image" content="/logo.png" />
	<link rel="canonical" href="/" />
</svelte:head>

<div class="relative flex min-h-screen items-center justify-center overflow-hidden">
	<!-- Background -->
	<div
		class="absolute inset-0 bg-cover bg-center bg-no-repeat"
		style="background-image: url('/landing.jpg'); filter: blur(2px);"
	></div>

	<!-- Overlay -->
	<div class="absolute inset-0 bg-black/30"></div>

	<!-- Content -->
	<div class="relative z-10 mx-4 w-full max-w-xl">
		<div class="relative">
			<!-- Glowing border effect -->
			<div
				class="absolute -inset-1 rounded-3xl bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 opacity-20 blur-lg transition-opacity duration-500"
			></div>

			<Card
				class="bg-white/98 relative overflow-hidden rounded-3xl border-0 shadow-2xl backdrop-blur-lg"
			>
				<CardHeader class="space-y-6 pb-6 pt-8 text-center">
					<!-- Logo/Icon -->
					<a href="https://www.monash.edu.my/">
						<div
							class="mx-auto flex transform items-center justify-center rounded-2xl transition-transform duration-300 hover:scale-105"
						>
							<!-- https://www.monash.edu.my/ -->
							<img src="/favicon.png" alt="SEMS Logo" class="h-24 w-24" />
						</div>
					</a>

					<div class="space-y-3">
						<CardTitle
							class="bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-3xl font-bold leading-tight text-transparent md:text-4xl"
						>
							Student Experience Management System
						</CardTitle>
						<p class="text-lg font-medium text-gray-600">
							Explore exciting student events happening around you!
						</p>
					</div>
				</CardHeader>

				<CardContent class="space-y-6 px-8 pb-4">
					<!-- Google Login Button -->
					<Button
						variant="outline"
						class="group relative h-14 w-full overflow-hidden rounded-2xl border-2 border-gray-200 bg-white text-lg font-semibold transition-all duration-300 hover:border-blue-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:shadow-xl hover:shadow-blue-100/50"
						onclick={handleGoogleLogin}
					>
						<!-- Button background animation -->
						<div
							class="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-purple-500/0 to-blue-500/0 transition-all duration-300 group-hover:from-blue-500/5 group-hover:via-purple-500/5 group-hover:to-blue-500/5"
						></div>

						<div class="relative flex items-center justify-center gap-4">
							<!-- Enhanced Google Logo -->
							<div class="relative">
								<svg
									class="h-6 w-6 transition-transform duration-300 group-hover:scale-110"
									viewBox="0 0 24 24"
								>
									<path
										fill="#4285F4"
										d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
									/>
									<path
										fill="#34A853"
										d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
									/>
									<path
										fill="#FBBC05"
										d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
									/>
									<path
										fill="#EA4335"
										d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
									/>
								</svg>
							</div>

							<span
								class="bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text font-semibold text-transparent"
							>
								Continue with Google
							</span>

							<!-- Arrow icon -->
							<svg
								class="h-5 w-5 text-gray-400 transition-all duration-300 group-hover:translate-x-1 group-hover:text-blue-500"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M17 8l4 4m0 0l-4 4m4-4H3"
								/>
							</svg>
						</div>
					</Button>

					<!-- Additional Info -->
					<div class="space-y-3 text-center">
						<!-- <div class="flex items-center justify-center gap-2 text-xs text-gray-500">
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
								/>
							</svg>
							<span>Secure authentication via ...</span>
						</div> -->

						<p class="text-xs leading-relaxed text-gray-400">
							By continuing, you agree to our Terms of Service and acknowledge our Privacy Policy.
						</p>
					</div>
				</CardContent>
			</Card>
		</div>
	</div>

	<!-- Scroll Down Indicator -->
	<button
		class="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 animate-bounce cursor-pointer transition-all duration-300 hover:scale-110 hover:opacity-100 focus:outline-none"
		onclick={scrollToAbout}
		type="button"
		aria-label="Scroll down to learn more"
	>
		<div class="flex flex-col items-center gap-2 text-white">
			<span class="text-sm font-medium">Learn More</span>
			<svg class="h-6 w-6 opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 9l6 6 6-6" />
			</svg>
		</div>
	</button>
</div>

<!-- About Section -->
<section id="about-section" class="bg-gray-50 px-6 py-20">
	<div class="mx-auto max-w-7xl">
		<div class="text-center">
			<h2 class="mb-8 text-4xl font-bold tracking-tight text-gray-900 lg:text-5xl">
				Your Gateway to Student Life
			</h2>
			<div class="mx-auto max-w-4xl space-y-6 text-lg leading-relaxed text-gray-600">
				<p>
					The Student Experience Management System serves as your starting point to explore and
					engage with the vibrant events and activities happening across Monash campus for students
					in the School of Information Technology and School of Engineering.
				</p>
				<p>
					Our platform acts as a comprehensive hub, providing students with detailed information
					about upcoming events including social gatherings, workshops, club activities, sports
					competitions, and academic seminars.
				</p>
				<p>
					We keep you informed and engaged by providing essential details such as event
					descriptions, schedules, and event venues, making it easy to find experiences that align
					with your interests and goals.
				</p>
			</div>
		</div>
	</div>
</section>

<!-- Why Join Events Section -->
<section class="bg-white px-6 py-20">
	<div class="mx-auto max-w-7xl">
		<div class="text-center">
			<h2 class="mb-4 text-4xl font-bold tracking-tight text-gray-900 lg:text-5xl">
				Why Join Events?
			</h2>
			<p class="mx-auto mb-16 max-w-2xl text-lg text-gray-600">
				Discover the transformative benefits of participating in campus events and activities.
			</p>
		</div>

		<div class="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
			<!-- Exciting Events Card -->
			<div
				class="group relative overflow-hidden rounded-2xl bg-white shadow-md transition-all duration-300 hover:shadow-xl"
			>
				<div class="relative aspect-[4/3] overflow-hidden">
					<img
						src="/about/why-1.jpg"
						alt="Exciting Events"
						class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-110"
					/>
				</div>
				<div class="p-8">
					<div class="mb-4 inline-flex items-center justify-center rounded-full bg-blue-100 p-3">
						<svg
							class="h-6 w-6 text-blue-600"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 10V3L4 14h7v7l9-11h-7z"
							/>
						</svg>
					</div>
					<h3 class="mb-4 text-xl font-bold text-gray-900">Exciting Events</h3>
					<p class="leading-relaxed text-gray-600">
						Join diverse and engaging events to connect with others, enjoy campus life, and pursue
						your passions. Make your university experience more fulfilling and memorable.
					</p>
				</div>
			</div>

			<!-- Socialise Card -->
			<div
				class="group relative overflow-hidden rounded-2xl bg-white shadow-md transition-all duration-300 hover:shadow-xl"
			>
				<div class="relative aspect-[4/3] overflow-hidden">
					<img
						src="/about/why-2.png"
						alt="Socialise"
						class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-110"
					/>
				</div>
				<div class="p-8">
					<div class="mb-4 inline-flex items-center justify-center rounded-full bg-purple-100 p-3">
						<svg
							class="h-6 w-6 text-purple-600"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
							/>
						</svg>
					</div>
					<h3 class="mb-4 text-xl font-bold text-gray-900">Build Connections</h3>
					<p class="leading-relaxed text-gray-600">
						Connect with like-minded peers who share your interests. Form lasting friendships,
						develop social skills, and create a strong sense of belonging within the university
						community.
					</p>
				</div>
			</div>

			<!-- Self-Improvement Card -->
			<div
				class="group relative overflow-hidden rounded-2xl bg-white shadow-md transition-all duration-300 hover:shadow-xl md:col-span-2 lg:col-span-1"
			>
				<div class="relative aspect-[4/3] overflow-hidden">
					<img
						src="/about/why-3.jpg"
						alt="Self-Improvement"
						class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-110"
					/>
				</div>
				<div class="p-8">
					<div class="mb-4 inline-flex items-center justify-center rounded-full bg-orange-100 p-3">
						<svg
							class="h-6 w-6 text-orange-600"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
							/>
						</svg>
					</div>
					<h3 class="mb-4 text-xl font-bold text-gray-900">Personal Growth</h3>
					<p class="leading-relaxed text-gray-600">
						Develop essential skills including teamwork, leadership, communication, problem-solving,
						time management, and organisational abilities through diverse activities and challenges.
					</p>
				</div>
			</div>
		</div>
	</div>
</section>

<!-- What Can You Do Section -->
<section class="bg-gray-50 px-6 py-20">
	<div class="mx-auto max-w-7xl">
		<div class="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
			<!-- Header Section -->
			<div>
				<h2 class="mb-6 text-4xl font-bold tracking-tight text-gray-900 lg:text-5xl">
					What Can You Do?
				</h2>
				<p class="text-lg text-gray-600">
					Explore the powerful features available to both students and event organisers on our
					platform.
				</p>
			</div>

			<!-- Features Section -->
			<div class="space-y-6">
				<Accordion type="multiple" class="w-full space-y-6">
					<!-- Students Features -->
					<AccordionItem
						value="students"
						class="overflow-hidden rounded-2xl border-none bg-white shadow-md"
					>
						<AccordionTrigger
							class="flex items-center justify-between bg-blue-50 px-8 py-6 font-semibold text-gray-900 transition-colors hover:bg-blue-100 hover:no-underline [&[data-state=open]>svg]:rotate-180"
						>
							<div class="flex items-center gap-4">
								<div class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
									<svg
										class="h-5 w-5 text-blue-600"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
										/>
									</svg>
								</div>
								<span class="text-lg">For Students</span>
							</div>
						</AccordionTrigger>
						<AccordionContent class="px-8 py-6">
							<div class="grid gap-4 sm:grid-cols-2">
								<div class="flex items-center gap-3">
									<div class="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
										<svg class="h-3 w-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
											<path
												fill-rule="evenodd"
												d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
												clip-rule="evenodd"
											/>
										</svg>
									</div>
									<span class="text-gray-700">Register for events</span>
								</div>
								<div class="flex items-center gap-3">
									<div class="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
										<svg class="h-3 w-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
											<path
												fill-rule="evenodd"
												d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
												clip-rule="evenodd"
											/>
										</svg>
									</div>
									<span class="text-gray-700">View personal event calendar</span>
								</div>
								<div class="flex items-center gap-3">
									<div class="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
										<svg class="h-3 w-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
											<path
												fill-rule="evenodd"
												d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
												clip-rule="evenodd"
											/>
										</svg>
									</div>
									<span class="text-gray-700">Search all campus events</span>
								</div>
								<div class="flex items-center gap-3">
									<div class="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
										<svg class="h-3 w-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
											<path
												fill-rule="evenodd"
												d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
												clip-rule="evenodd"
											/>
										</svg>
									</div>
									<span class="text-gray-700">Track attendance history</span>
								</div>
							</div>
						</AccordionContent>
					</AccordionItem>

					<!-- Organisers Features -->
					<AccordionItem
						value="organisers"
						class="overflow-hidden rounded-2xl border-none bg-white shadow-md"
					>
						<AccordionTrigger
							class="flex items-center justify-between bg-purple-50 px-8 py-6 font-semibold text-gray-900 transition-colors hover:bg-purple-100 hover:no-underline [&[data-state=open]>svg]:rotate-180"
						>
							<div class="flex items-center gap-4">
								<div class="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
									<svg
										class="h-5 w-5 text-purple-600"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
										/>
									</svg>
								</div>
								<span class="text-lg">For Organisers</span>
							</div>
						</AccordionTrigger>
						<AccordionContent class="px-8 py-6">
							<div class="grid gap-4 sm:grid-cols-2">
								<div class="flex items-center gap-3">
									<div class="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
										<svg class="h-3 w-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
											<path
												fill-rule="evenodd"
												d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
												clip-rule="evenodd"
											/>
										</svg>
									</div>
									<span class="text-gray-700">Create and publish events</span>
								</div>
								<div class="flex items-center gap-3">
									<div class="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
										<svg class="h-3 w-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
											<path
												fill-rule="evenodd"
												d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
												clip-rule="evenodd"
											/>
										</svg>
									</div>
									<span class="text-gray-700">Manage event details</span>
								</div>
								<div class="flex items-center gap-3">
									<div class="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
										<svg class="h-3 w-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
											<path
												fill-rule="evenodd"
												d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
												clip-rule="evenodd"
											/>
										</svg>
									</div>
									<span class="text-gray-700">Track registrations</span>
								</div>
								<div class="flex items-center gap-3">
									<div class="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
										<svg class="h-3 w-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
											<path
												fill-rule="evenodd"
												d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
												clip-rule="evenodd"
											/>
										</svg>
									</div>
									<span class="text-gray-700">Provide event information</span>
								</div>
							</div>
						</AccordionContent>
					</AccordionItem>
				</Accordion>
			</div>
		</div>
	</div>
</section>

<!-- Development Teams Section -->
<section class="bg-white px-6 py-20">
	<div class="mx-auto max-w-7xl">
		<div class="text-center">
			<h2 class="mb-4 text-4xl font-bold tracking-tight text-gray-900 lg:text-5xl">
				Development Teams
			</h2>
			<p class="mx-auto mb-16 max-w-2xl text-lg text-gray-600">
				Meet the talented teams who have worked on SEMS throughout the years.
			</p>
		</div>

		<div class="grid gap-8 md:grid-cols-3">
			<!-- 2022 Team -->
			<div class="text-center">
				<HoverCard.Root>
					<HoverCard.Trigger>
						<div
							class="cursor-pointer overflow-hidden rounded-2xl bg-white p-2 shadow-lg transition-transform duration-300 hover:scale-105"
						>
							<img
								src="/about/dev-team-2022.jpg"
								alt="2022 Development Team"
								class="h-64 w-full rounded-xl object-cover"
							/>
						</div>
					</HoverCard.Trigger>
					<HoverCard.Content class="w-80">
						<div class="space-y-2">
							<h4 class="text-sm font-semibold">2022 Development Team (v1.0)</h4>
							<p class="text-muted-foreground text-sm">
								The founding team that initiated the SEMS project, establishing the core
								architecture and fundamental features that serve as the foundation for the platform.
							</p>
						</div>
					</HoverCard.Content>
				</HoverCard.Root>
				<p class="mt-4 text-lg font-medium text-gray-700">2022 Development Team</p>
			</div>

			<!-- 2023 Team -->
			<div class="text-center">
				<HoverCard.Root>
					<HoverCard.Trigger>
						<div
							class="cursor-pointer overflow-hidden rounded-2xl bg-white p-2 shadow-lg transition-transform duration-300 hover:scale-105"
						>
							<img
								src="/about/dev-team-2023.jpg"
								alt="2023 Development Team"
								class="h-64 w-full rounded-xl object-cover"
							/>
						</div>
					</HoverCard.Trigger>
					<HoverCard.Content class="w-80">
						<div class="space-y-2">
							<h4 class="text-sm font-semibold">2023 Development Team (v1.1)</h4>
							<p class="text-muted-foreground text-sm">
								Building upon the previous year's work, this team enhanced SEMS with improved
								functionality, refined user experience, and expanded capabilities for event
								management.
							</p>
						</div>
					</HoverCard.Content>
				</HoverCard.Root>
				<p class="mt-4 text-lg font-medium text-gray-700">2023 Development Team</p>
			</div>

			<!-- 2025 Team -->
			<div class="text-center">
				<HoverCard.Root>
					<HoverCard.Trigger>
						<div
							class="cursor-pointer overflow-hidden rounded-2xl bg-white p-2 shadow-lg transition-transform duration-300 hover:scale-105"
						>
							<img
								src="/about/dev-team-2025.jpg"
								alt="2025 Development Team"
								class="h-64 w-full rounded-xl object-cover"
							/>
						</div>
					</HoverCard.Trigger>
					<HoverCard.Content class="w-80">
						<div class="space-y-2">
							<h4 class="text-sm font-semibold">2025 Development Team (v2.0)</h4>
							<p class="text-muted-foreground text-sm">
								Performed a full remake and redesign of SEMS from the ground up, rebuilding the
								entire platform with modern technologies and architecture to deliver an exceptional
								student experience.
							</p>
						</div>
					</HoverCard.Content>
				</HoverCard.Root>
				<p class="mt-4 text-lg font-medium text-gray-700">2025 Development Team</p>
			</div>
		</div>
	</div>
</section>
