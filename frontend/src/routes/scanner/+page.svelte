<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { browser } from '$app/environment';
	import QrScanner from 'qr-scanner';
	import { toast } from 'svelte-sonner';
	import { markAttendance } from '$lib/database';
	import { requireProfile } from '$lib/auth';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import {
		Camera,
		CameraOff,
		RefreshCw,
		CheckCircle,
		XCircle,
		QrCode,
		AlertTriangle,
		Trash2,
		Clock
	} from '@lucide/svelte';

	let { data } = $props();
	let { supabase } = $derived(data);

	// State management
	let videoElement = $state<HTMLVideoElement | null>(null);
	let qrScanner = $state<QrScanner | null>(null);
	let isScanning = $state(false);
	let hasCamera = $state(false);
	let cameraError = $state<string | null>(null);
	let lastScannedCode = $state<string | null>(null);
	let scanResult = $state<{ type: 'success' | 'error'; message: string } | null>(null);
	let isProcessing = $state(false);
	let currentUser = $state<any>(null);
	let scanCount = $state(0);
	let successfulScans = $state(0);

	// Scan history management
	type ScanHistoryItem = {
		id: string;
		timestamp: Date;
		registrationId: string;
		success: boolean;
		message: string;
	};
	let scanHistory = $state<ScanHistoryItem[]>([]);

	onMount(async () => {
		if (!browser) return;

		try {
			// Load user profile
			currentUser = await requireProfile(supabase);
			if (!currentUser) {
				return; // User will be redirected to registration
			}

			// Check if QR scanner is supported
			if (!QrScanner.hasCamera()) {
				cameraError = 'No camera found or camera access not supported';
				return;
			}

			hasCamera = true;
			await initializeScanner();
		} catch (error) {
			console.error('Error initializing scanner:', error);
			cameraError = 'Failed to initialize camera';
		}
	});

	onDestroy(() => {
		if (qrScanner) {
			qrScanner.destroy();
		}
	});

	async function initializeScanner() {
		if (!videoElement || qrScanner) return;

		try {
			// First, check if we can access the camera
			const hasPermission = await checkCameraPermission();
			if (!hasPermission) {
				cameraError =
					'Camera access denied. Please grant camera permissions in your browser settings and refresh the page.';
				hasCamera = false;
				return;
			}

			// Make sure the scanner is marked as starting BEFORE creating the QrScanner
			// This ensures the video element is visible
			isScanning = true;

			qrScanner = new QrScanner(videoElement as HTMLVideoElement, handleQrScan, {
				onDecodeError: (error) => {
					// Silently handle decode errors (normal when no QR code is visible)
					console.debug('QR decode error:', error);
				},
				highlightScanRegion: true,
				highlightCodeOutline: true,
				maxScansPerSecond: 3
			});

			await qrScanner.start();
			cameraError = null;
			hasCamera = true;
		} catch (error: any) {
			console.error('Error starting scanner:', error);

			// Reset scanning state on error
			isScanning = false;

			// Clean up scanner if it was partially created
			if (qrScanner) {
				qrScanner.destroy();
				qrScanner = null;
			}

			// Better error handling based on error type
			if (error.name === 'NotAllowedError' || error.message?.includes('Permission denied')) {
				cameraError =
					'Camera access denied. Please grant camera permissions in your browser settings and refresh the page.';
			} else if (error.name === 'NotFoundError' || error.message?.includes('No camera')) {
				cameraError = 'No camera found. Please ensure your device has a camera.';
			} else if (error.name === 'NotReadableError') {
				cameraError =
					'Camera is already in use by another application. Please close other apps using the camera.';
			} else {
				cameraError = 'Failed to start camera. Please check your browser settings and try again.';
			}
			hasCamera = false;
		}
	}

	async function checkCameraPermission(): Promise<boolean> {
		try {
			// Try to get camera permission status if available
			if ('permissions' in navigator) {
				const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
				if (permission.state === 'denied') {
					return false;
				}
			}

			// Try to access camera to trigger permission prompt if needed
			const stream = await navigator.mediaDevices.getUserMedia({ video: true });
			// Clean up the stream immediately
			stream.getTracks().forEach((track) => track.stop());
			return true;
		} catch (error: any) {
			console.error('Camera permission check failed:', error);
			return false;
		}
	}

	async function handleQrScan(result: QrScanner.ScanResult) {
		const DELAY = 3000; // 3 second delay before allowing next scan
		const scannedCode = result.data;

		// Prevent processing the same code multiple times
		if (scannedCode === lastScannedCode || isProcessing) {
			return;
		}

		lastScannedCode = scannedCode;
		isProcessing = true;
		scanCount++;

		try {
			// Parse the QR code - expecting a registration ID
			// For now, we'll assume the QR code contains just the registration ID
			// In a real implementation, you might have a more complex format like JSON or URL
			const registrationId = scannedCode.trim();

			if (!registrationId) {
				throw new Error('Invalid QR code format');
			}

			// Mark attendance
			const result = await markAttendance(supabase, registrationId);

			// Add to scan history
			const historyItem: ScanHistoryItem = {
				id: `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
				timestamp: new Date(),
				registrationId: registrationId,
				success: result.success,
				message: result.message
			};
			scanHistory = [historyItem, ...scanHistory]; // Add to beginning of array

			if (result.success) {
				successfulScans++;
				scanResult = {
					type: 'success',
					message: result.message
				};
				toast.success(`Success! ${result.message}`);
			} else {
				scanResult = {
					type: 'error',
					message: result.message
				};
				// Show different toast messages based on the error type
				if (result.message.includes('already marked')) {
					toast.warning(result.message);
				} else {
					toast.error(result.message);
				}
			}
		} catch (error) {
			console.error('Error processing QR code:', error);

			// Add error to scan history
			const errorMessage = 'Invalid QR code or processing error';
			const historyItem: ScanHistoryItem = {
				id: `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
				timestamp: new Date(),
				registrationId: scannedCode,
				success: false,
				message: errorMessage
			};
			scanHistory = [historyItem, ...scanHistory];

			scanResult = {
				type: 'error',
				message: errorMessage
			};
			toast.error('Invalid QR code');
		} finally {
			isProcessing = false;
			// Clear the result after a delay - use requestAnimationFrame to prevent flash
			setTimeout(() => {
				requestAnimationFrame(() => {
					scanResult = null;
					lastScannedCode = null;
				});
			}, DELAY);
		}
	}

	async function toggleScanner() {
		if (!qrScanner) {
			await initializeScanner();
			return;
		}

		if (isScanning) {
			await qrScanner.stop();
			isScanning = false;
		} else {
			try {
				await qrScanner.start();
				isScanning = true;
				cameraError = null;
			} catch (error: any) {
				console.error('Error restarting scanner:', error);
				// Handle permission errors when restarting
				if (error.name === 'NotAllowedError' || error.message?.includes('Permission denied')) {
					cameraError =
						'Camera access denied. Please grant camera permissions in your browser settings and refresh the page.';
				} else {
					cameraError = 'Failed to restart camera. Please try again.';
				}
				isScanning = false;
			}
		}
	}

	async function restartScanner() {
		// Stop and clean up existing scanner
		if (qrScanner) {
			try {
				await qrScanner.stop();
			} catch (e) {
				console.debug('Error stopping scanner:', e);
			}
			qrScanner.destroy();
			qrScanner = null;
		}

		// Reset all state
		isScanning = false;
		lastScannedCode = null;
		scanResult = null;
		cameraError = null;
		hasCamera = false;

		// Force a re-render and wait longer for camera to be released
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Re-check camera availability
		try {
			const hasCam = await QrScanner.hasCamera();
			if (!hasCam) {
				cameraError = 'No camera found or camera access not supported';
				return;
			}
			hasCamera = true;
		} catch (error) {
			console.error('Error checking camera after restart:', error);
			cameraError = 'Failed to access camera after restart';
			return;
		}

		// Reinitialize
		await initializeScanner();
	}

	function clearScanHistory() {
		scanHistory = [];
		toast.info('Scan history cleared');
	}
</script>

<svelte:head>
	<title>QR Scanner - SEMS</title>
	<meta name="description" content="Scan QR codes to mark student attendance at events." />
	<meta name="keywords" content="QR scanner, attendance, student events, check-in" />
	<meta property="og:title" content="QR Scanner - SEMS" />
	<meta property="og:description" content="Scan QR codes to mark student attendance at events." />
	<meta property="og:type" content="website" />
	<meta property="og:image" content="/logo.png" />
	<meta name="robots" content="noindex, nofollow" />
	<link rel="canonical" href="/scanner" />
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<!-- Header -->
	<div class="mb-6 ">
		<h1 class="text-3xl font-bold text-gray-900">QR Code Scanner</h1>
		<p class="mt-2 text-gray-600">Scan registrant QR codes to mark attendance at events.</p>
	</div>

	<!-- Statistics Card - Always rendered to prevent layout shift -->
	<Card
		class="mb-6 transition-opacity duration-200 {scanCount === 0 ? 'opacity-60' : 'opacity-100'}"
	>
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<QrCode class="h-5 w-5" />
				Scan Statistics
			</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="grid grid-cols-2 gap-4">
				<div class="text-center">
					<div class="text-2xl font-bold {scanCount > 0 ? 'text-blue-600' : 'text-gray-400'}">
						{scanCount}
					</div>
					<div class="text-sm text-gray-600">Total Scans</div>
				</div>
				<div class="text-center">
					<div
						class="text-2xl font-bold {successfulScans > 0 ? 'text-green-600' : 'text-gray-400'}"
					>
						{successfulScans}
					</div>
					<div class="text-sm text-gray-600">Successful</div>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Scanner Card -->
	<Card class="mb-6">
		<CardHeader>
			<CardTitle class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<Camera class="h-5 w-5" />
					Camera Scanner
				</div>
				{#if hasCamera || isScanning}
					{#if isScanning}
						<Badge class="bg-green-100 text-green-800">
							<div class="mr-1 h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
							Scanning Active
						</Badge>
					{:else}
						<Badge variant="outline" class="bg-gray-50">Scanner Stopped</Badge>
					{/if}
				{/if}
			</CardTitle>
			<CardDescription>
				{#if isScanning}
					Camera is active. Point your camera at a QR code to scan.
				{:else if hasCamera}
					Camera is ready. Click start to begin scanning.
				{:else}
					Camera initialization required.
				{/if}
			</CardDescription>
		</CardHeader>
		<CardContent>
			{#if cameraError}
				<!-- Error State -->
				<div class="py-12 text-center">
					<div
						class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100"
					>
						<CameraOff class="h-8 w-8 text-red-600" />
					</div>
					<h3 class="mb-2 text-lg font-medium text-gray-900">Camera Error</h3>
					<p class="mx-auto mb-4 max-w-md text-gray-600">{cameraError}</p>

					{#if cameraError.includes('denied')}
						<div class="mx-auto mb-4 max-w-md rounded-lg bg-yellow-50 p-4 text-left">
							<h4 class="mb-2 font-medium text-gray-900">How to enable camera permissions:</h4>
							<ol class="space-y-1 text-sm text-gray-600">
								<li>1. Click the lock/info icon in your browser's address bar</li>
								<li>2. Find "Camera" in the permissions list</li>
								<li>3. Change it from "Block" to "Allow"</li>
								<li>4. Refresh this page</li>
							</ol>
						</div>
					{/if}

					<div class="flex justify-center gap-2">
						<Button onclick={restartScanner} class="flex items-center gap-2">
							<RefreshCw class="h-4 w-4" />
							Retry
						</Button>
						<Button
							variant="outline"
							onclick={() => window.location.reload()}
							class="flex items-center gap-2"
						>
							<RefreshCw class="h-4 w-4" />
							Refresh Page
						</Button>
					</div>
				</div>
			{:else if hasCamera}
				<!-- Camera View -->
				<div class="space-y-4">
					<!-- Video Element or Placeholder -->
					<div
						class="relative mx-auto max-w-md overflow-hidden rounded-lg bg-gray-900"
						style="height: 400px;"
					>
						{#if !isScanning}
							<!-- Camera Off Placeholder - exact same size as video -->
							<div
								class="absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 bg-gray-50 p-8"
							>
								<Camera class="mb-4 h-16 w-16 text-gray-400" />
								<h3 class="mb-2 text-lg font-medium text-gray-900">Camera Ready</h3>
								<p class="text-center text-sm text-gray-600">
									Click "Start Scanner" to begin scanning QR codes
								</p>
							</div>
						{/if}

						<!-- Video element - let QrScanner handle its visibility -->
						<video bind:this={videoElement} class="h-full w-full object-cover" muted playsinline
						></video>

						<!-- Overlay for scanning status -->
						{#if isProcessing && isScanning}
							<div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
								<div class="rounded-lg bg-white p-4">
									<div class="flex items-center gap-2">
										<div class="h-6 w-6 animate-spin rounded-full border-b-2 border-gray-900"></div>
										<span class="text-sm font-medium">Processing...</span>
									</div>
								</div>
							</div>
						{/if}
					</div>

					<!-- Scan Result -->
					{#if scanResult}
						<div
							class="rounded-lg border p-4 transition-opacity duration-200 {scanResult.type ===
							'success'
								? 'border-green-200 bg-green-50'
								: 'border-red-200 bg-red-50'}"
						>
							<div class="flex items-center gap-2">
								{#if scanResult.type === 'success'}
									<CheckCircle class="h-5 w-5 text-green-600" />
									<span class="font-medium text-green-900">Success</span>
								{:else}
									<XCircle class="h-5 w-5 text-red-600" />
									<span class="font-medium text-red-900">Error</span>
								{/if}
							</div>
							<p
								class="mt-1 text-sm {scanResult.type === 'success'
									? 'text-green-700'
									: 'text-red-700'}"
							>
								{scanResult.message}
							</p>
						</div>
					{:else}
						<!-- Empty div to maintain consistent height and prevent layout shift -->
						<div class="h-[88px]"></div>
					{/if}

					<!-- Controls -->
					<div class="flex flex-col gap-2 sm:flex-row sm:justify-center">
						<Button
							onclick={toggleScanner}
							variant={isScanning ? 'destructive' : 'default'}
							class="flex items-center gap-2"
						>
							{#if isScanning}
								<CameraOff class="h-4 w-4" />
								Stop Scanner
							{:else}
								<Camera class="h-4 w-4" />
								Start Scanner
							{/if}
						</Button>
						{#if qrScanner || cameraError}
							<Button variant="outline" onclick={restartScanner} class="flex items-center gap-2">
								<RefreshCw class="h-4 w-4" />
								Restart
							</Button>
						{/if}
					</div>
				</div>
			{:else}
				<!-- Loading State -->
				<div class="py-12 text-center">
					<div
						class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"
					></div>
					<h3 class="mb-2 text-lg font-medium text-gray-900">Initializing Camera</h3>
					<p class="text-gray-600">Please wait while we set up your camera...</p>
				</div>
			{/if}
		</CardContent>
	</Card>

	<!-- Instructions Card -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<AlertTriangle class="h-5 w-5" />
				Instructions
			</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="space-y-3 text-sm text-gray-600">
				<div class="flex items-start gap-2">
					<div class="mt-1 h-2 w-2 rounded-full bg-blue-500"></div>
					<span>Point your camera at a registrant's QR code</span>
				</div>
				<div class="flex items-start gap-2">
					<div class="mt-1 h-2 w-2 rounded-full bg-blue-500"></div>
					<span>The scanner will automatically detect and process QR codes</span>
				</div>
				<div class="flex items-start gap-2">
					<div class="mt-1 h-2 w-2 rounded-full bg-blue-500"></div>
					<span>Successful scans will mark attendance in the system</span>
				</div>
				<div class="flex items-start gap-2">
					<div class="mt-1 h-2 w-2 rounded-full bg-blue-500"></div>
					<span>Allow camera permissions when prompted by your browser</span>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Scan History Card -->
	<Card class="mt-6">
		<CardHeader>
			<CardTitle class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<Clock class="h-5 w-5" />
					Scan History
					{#if scanHistory.length > 0}
						<Badge variant="outline" class="ml-2">{scanHistory.length} scan{scanHistory.length !== 1 ? 's' : ''}</Badge>
					{/if}
				</div>
				{#if scanHistory.length > 0}
					<Button variant="outline" size="sm" onclick={clearScanHistory} class="flex items-center gap-2">
						<Trash2 class="h-4 w-4" />
						Clear History
					</Button>
				{/if}
			</CardTitle>
			<CardDescription>
				{#if scanHistory.length === 0}
					No scans yet. Scan results will appear here for quick reference.
				{:else}
					Recent scans are shown below. This helps track attendance marking progress.
				{/if}
			</CardDescription>
		</CardHeader>
		<CardContent>
			{#if scanHistory.length === 0}
				<!-- Empty state -->
				<div class="py-8 text-center">
					<QrCode class="mx-auto mb-4 h-12 w-12 text-gray-400" />
					<h3 class="mb-2 text-lg font-medium text-gray-900">No scan history</h3>
					<p class="text-gray-600">Scan your first QR code to see results here</p>
				</div>
			{:else}
				<!-- Scrollable history container with fixed height -->
				<div class="h-80 overflow-y-auto space-y-2 pr-2">
					{#each scanHistory as item (item.id)}
						<div
							class="rounded-lg border p-3 transition-all duration-200 hover:shadow-sm {item.success
								? 'border-green-200 bg-green-50 hover:bg-green-100'
								: 'border-red-200 bg-red-50 hover:bg-red-100'}"
						>
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									{#if item.success}
										<CheckCircle class="h-4 w-4 text-green-600" />
										<span class="text-sm font-medium text-green-900">Success</span>
									{:else}
										<XCircle class="h-4 w-4 text-red-600" />
										<span class="text-sm font-medium text-red-900">Failed</span>
									{/if}
								</div>
								<span class="text-xs text-gray-500">
									{item.timestamp.toLocaleTimeString()}
								</span>
							</div>
							<div class="mt-2">
								<p class="text-sm {item.success ? 'text-green-700' : 'text-red-700'}">
									{item.message}
								</p>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
