<script lang="ts">
	import { onMount } from 'svelte';
	import { getLocalTimeZone, CalendarDate } from '@internationalized/date';
	import type { CalendarDate as CalendarDateType } from '@internationalized/date';
	import { toast } from 'svelte-sonner';
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
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import Calendar from '$lib/components/ui/calendar/calendar.svelte';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import {
		ChartContainer,
		ChartTooltip,
		type ChartConfig
	} from '$lib/components/ui/chart/index.js';
	import {
		BarChart3,
		Users,
		Building,
		Download,
		RefreshCw,
		TrendingUp,
		TrendingDown,
		Filter,
		FileSpreadsheet,
		UserCheck,
		UserPlus,
		Activity,
		Target,
		CalendarIcon,
		Search,
		FileText
	} from '@lucide/svelte';
	import {
		getAnalyticsOverview,
		getEventAnalytics,
		getMonthlyStats,
		getOrganisationStats,
		getUserInsights,
		getOrganisations,
		type AnalyticsOverview,
		type EventAnalytics,
		type MonthlyStats,
		type OrganisationStats,
		type UserInsights
	} from '$lib/database';
	import type { Organisation } from '$lib/types';
	import { requireProfile } from '$lib/auth';
	import { checkAdminAccess } from '$lib/permissions';
	import { goto } from '$app/navigation';
	import * as XLSX from 'xlsx';
	import jsPDF from 'jspdf';
	import autoTable from 'jspdf-autotable';

	let { data } = $props();
	let { supabase } = $derived(data);

	// State
	let loading = $state(true);
	let exportLoading = $state(false);
	let pdfLoading = $state(false);
	let overview = $state<AnalyticsOverview | null>(null);
	let eventAnalytics = $state<EventAnalytics[]>([]);
	let monthlyStats = $state<MonthlyStats[]>([]);
	let organisationStats = $state<OrganisationStats[]>([]);
	let userInsights = $state<UserInsights | null>(null);
	let organisations = $state<Organisation[]>([]);

	// Filters
	let startDate = $state('');
	let endDate = $state('');
	let selectedOrganisation = $state('');

	// Calendar date states
	let startDatePicker = $state<CalendarDateType | undefined>(undefined);
	let endDatePicker = $state<CalendarDateType | undefined>(undefined);

	// Popover states
	let openStartDate = $state(false);
	let openEndDate = $state(false);

	// Chart configuration
	const chartConfig: ChartConfig = {
		events: {
			label: 'Events',
			color: 'hsl(var(--chart-1))'
		},
		registrations: {
			label: 'Registrations',
			color: 'hsl(var(--chart-2))'
		},
		attendance: {
			label: 'Attendance',
			color: 'hsl(var(--chart-3))'
		}
	};

	// Colors for pie chart
	const COLORS = [
		'hsl(var(--chart-1))',
		'hsl(var(--chart-2))',
		'hsl(var(--chart-3))',
		'hsl(var(--chart-4))',
		'hsl(var(--chart-5))'
	];

	onMount(async () => {
		// Check permissions
		const hasAccess = await checkAdminAccess(supabase);
		if (!hasAccess) {
			goto('/forbidden');
			return;
		}

		// Ensure user is authenticated
		const profile = await requireProfile(supabase);
		if (!profile) {
			goto('/');
			return;
		}

		// Set default date range (start of previous month to end of previous month)
		const now = new Date();
		const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1); // First day of previous month
		const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month

		// Format dates without timezone issues
		const formatLocalDate = (date: Date) => {
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');
			return `${year}-${month}-${day}`;
		};

		startDate = formatLocalDate(startOfPreviousMonth);
		endDate = formatLocalDate(endOfPreviousMonth);

		// Set calendar picker values
		startDatePicker = new CalendarDate(
			startOfPreviousMonth.getFullYear(),
			startOfPreviousMonth.getMonth() + 1,
			startOfPreviousMonth.getDate()
		);
		endDatePicker = new CalendarDate(
			endOfPreviousMonth.getFullYear(),
			endOfPreviousMonth.getMonth() + 1,
			endOfPreviousMonth.getDate()
		);

		await loadData();
		await loadOrganisations();
	});

	async function loadOrganisations() {
		try {
			const orgs = await getOrganisations(supabase);
			organisations = orgs;
		} catch (error) {
			console.error('Error loading organisations:', error);
			toast.error('Failed to load organisations');
		}
	}

	async function loadData() {
		loading = true;
		try {
			console.log('Loading analytics data...', $state.snapshot({ startDate, endDate, selectedOrganisation }));
			const [overviewData, eventData, monthlyData, orgData, userInsightsData] = await Promise.all([
				getAnalyticsOverview(supabase, startDate, endDate),
				getEventAnalytics(supabase, startDate, endDate, selectedOrganisation || undefined),
				getMonthlyStats(supabase, startDate, endDate),
				getOrganisationStats(supabase, startDate, endDate),
				getUserInsights(supabase, startDate, endDate)
			]);

			console.log('Analytics data loaded:', {
				overview: overviewData,
				events: eventData?.length,
				monthly: monthlyData?.length,
				orgs: orgData?.length,
				userInsights: userInsightsData
			});

			// Debug the userInsights data specifically
			if (userInsightsData) {
				console.log('UserInsights detailed:', {
					totalActiveUsers: userInsightsData.totalActiveUsers,
					newUsersThisPeriod: userInsightsData.newUsersThisPeriod,
					userEngagementRate: userInsightsData.userEngagementRate,
					averageEventsPerUser: userInsightsData.averageEventsPerUser,
					enrollmentYears: userInsightsData.usersByEnrollmentYear?.length || 0,
					studyPrograms: userInsightsData.topStudyPrograms?.length || 0,
					roles: userInsightsData.usersByRole?.length || 0
				});
			}

			overview = overviewData;
			eventAnalytics = eventData;
			monthlyStats = monthlyData;
			organisationStats = orgData;
			userInsights = userInsightsData;

			console.log('UserInsights assigned:', $state.snapshot(userInsights));
		} catch (error) {
			console.error('Error loading analytics data:', error);
			toast.error('Failed to load analytics data');
		} finally {
			loading = false;
		}
	}

	async function handleFilterChange() {
		// Remove automatic loading - only trigger on search button click
	}

	function handleOrganisationChange() {
		// Remove automatic loading - only trigger on search button click
	}

	function handleStartDateChange() {
		if (startDatePicker) {
			// Extract date components directly to avoid timezone issues
			const year = startDatePicker.year;
			const month = String(startDatePicker.month).padStart(2, '0');
			const day = String(startDatePicker.day).padStart(2, '0');
			startDate = `${year}-${month}-${day}`;
		}
		openStartDate = false;
	}

	function handleEndDateChange() {
		if (endDatePicker) {
			// Extract date components directly to avoid timezone issues
			const year = endDatePicker.year;
			const month = String(endDatePicker.month).padStart(2, '0');
			const day = String(endDatePicker.day).padStart(2, '0');
			endDate = `${year}-${month}-${day}`;
		}
		openEndDate = false;
	}

	function clearFilters() {
		// Reset to default date range (start of previous month to end of previous month)
		const now = new Date();
		const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1); // First day of previous month
		const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month

		// Format dates without timezone issues
		const formatLocalDate = (date: Date) => {
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');
			return `${year}-${month}-${day}`;
		};

		startDate = formatLocalDate(startOfPreviousMonth);
		endDate = formatLocalDate(endOfPreviousMonth);
		selectedOrganisation = '';

		// Reset calendar picker values
		startDatePicker = new CalendarDate(
			startOfPreviousMonth.getFullYear(),
			startOfPreviousMonth.getMonth() + 1,
			startOfPreviousMonth.getDate()
		);
		endDatePicker = new CalendarDate(
			endOfPreviousMonth.getFullYear(),
			endOfPreviousMonth.getMonth() + 1,
			endOfPreviousMonth.getDate()
		);
	}

	async function handleSearch() {
		await loadData();
	}

	async function exportToExcel() {
		exportLoading = true;
		try {
			// Create workbook
			const wb = XLSX.utils.book_new();

			// Overview sheet
			if (overview) {
				const overviewData = [
					['Metric', 'Value'],
					['Total Events', overview.totalEvents],
					['Total Registrations', overview.totalRegistrations],
					['Total Users', overview.totalUsers],
					['Total Organisations', overview.totalOrganisations],
					['Average Attendance Rate', `${overview.averageAttendanceRate.toFixed(2)}%`]
				];
				const overviewWS = XLSX.utils.aoa_to_sheet(overviewData);
				XLSX.utils.book_append_sheet(wb, overviewWS, 'Overview');
			}

			// Event analytics sheet
			if (eventAnalytics.length > 0) {
				const eventData = [
					[
						'Event Name',
						'Organisation',
						'Registration Count',
						'Attendance Count',
						'Attendance Rate (%)',
						'Capacity',
						'Utilization Rate (%)',
						'Start Date',
						'State',
						'Mode'
					],
					...eventAnalytics.map((event) => [
						event.eventName,
						event.organisationName,
						event.registrationCount,
						event.attendanceCount,
						event.attendanceRate.toFixed(2),
						event.capacity || 'N/A',
						event.utilizationRate?.toFixed(2) || 'N/A',
						new Date(event.startDate).toLocaleDateString(),
						event.eventState,
						event.eventMode
					])
				];
				const eventWS = XLSX.utils.aoa_to_sheet(eventData);
				XLSX.utils.book_append_sheet(wb, eventWS, 'Event Analytics');
			}

			// Monthly stats sheet
			if (monthlyStats.length > 0) {
				const monthlyData = [
					['Month', 'Year', 'Event Count', 'Registration Count', 'Attendance Count'],
					...monthlyStats.map((month) => [
						month.month,
						month.year,
						month.eventCount,
						month.registrationCount,
						month.attendanceCount
					])
				];
				const monthlyWS = XLSX.utils.aoa_to_sheet(monthlyData);
				XLSX.utils.book_append_sheet(wb, monthlyWS, 'Monthly Stats');
			}

			// Organisation stats sheet
			if (organisationStats.length > 0) {
				const orgData = [
					[
						'Organisation',
						'Event Count',
						'Total Registrations',
						'Total Attendance',
						'Attendance Rate (%)',
						'Member Count'
					],
					...organisationStats.map((org) => [
						org.organisationName,
						org.eventCount,
						org.totalRegistrations,
						org.totalAttendance,
						org.averageAttendanceRate.toFixed(2),
						org.memberCount
					])
				];
				const orgWS = XLSX.utils.aoa_to_sheet(orgData);
				XLSX.utils.book_append_sheet(wb, orgWS, 'Organisation Stats');
			}

			// User insights sheet
			if (userInsights) {
				const userInsightsData = [
					['Metric', 'Value'],
					['Total Active Users', userInsights.totalActiveUsers],
					['New Users This Period', userInsights.newUsersThisPeriod],
					['User Engagement Rate (%)', userInsights.userEngagementRate.toFixed(2)],
					['Average Events Per User', userInsights.averageEventsPerUser.toFixed(2)]
				];
				const userInsightsWS = XLSX.utils.aoa_to_sheet(userInsightsData);
				XLSX.utils.book_append_sheet(wb, userInsightsWS, 'User Insights');

				// Study programs sheet
				if (userInsights.topStudyPrograms.length > 0) {
					const studyProgramData = [
						['Study Program', 'User Count', 'Percentage (%)'],
						...userInsights.topStudyPrograms.map((program) => [
							program.programName,
							program.userCount,
							program.percentage.toFixed(2)
						])
					];
					const studyProgramWS = XLSX.utils.aoa_to_sheet(studyProgramData);
					XLSX.utils.book_append_sheet(wb, studyProgramWS, 'Study Programs');
				}

				// Most engaged users sheet
				if (userInsights.mostEngagedUsers.length > 0) {
					const engagedUsersData = [
						['User Name', 'Events Registered', 'Events Attended', 'Attendance Rate (%)'],
						...userInsights.mostEngagedUsers.map((user) => [
							user.userName,
							user.eventsRegistered,
							user.eventsAttended,
							user.attendanceRate.toFixed(2)
						])
					];
					const engagedUsersWS = XLSX.utils.aoa_to_sheet(engagedUsersData);
					XLSX.utils.book_append_sheet(wb, engagedUsersWS, 'Most Engaged Users');
				}
			}

			// Generate and download file
			const fileName = `SEMS_Analytics_${new Date().toISOString().split('T')[0]}.xlsx`;
			XLSX.writeFile(wb, fileName);

			toast.success('Analytics data exported successfully');
		} catch (error) {
			console.error('Error exporting data:', error);
			toast.error('Failed to export data');
		} finally {
			exportLoading = false;
		}
	}

	function exportToCSV() {
		if (eventAnalytics.length === 0) {
			toast.error('No data to export');
			return;
		}

		const headers = [
			'Event Name',
			'Organisation',
			'Registration Count',
			'Attendance Count',
			'Attendance Rate (%)',
			'Capacity',
			'Utilization Rate (%)',
			'Start Date',
			'State',
			'Mode'
		];

		const csvContent = [
			headers.join(','),
			...eventAnalytics.map((event) =>
				[
					`"${event.eventName}"`,
					`"${event.organisationName}"`,
					event.registrationCount,
					event.attendanceCount,
					event.attendanceRate.toFixed(2),
					event.capacity || 'N/A',
					event.utilizationRate?.toFixed(2) || 'N/A',
					new Date(event.startDate).toLocaleDateString(),
					event.eventState,
					event.eventMode
				].join(',')
			)
		].join('\n');

		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		const url = URL.createObjectURL(blob);
		link.setAttribute('href', url);
		link.setAttribute(
			'download',
			`SEMS_Event_Analytics_${new Date().toISOString().split('T')[0]}.csv`
		);
		link.style.visibility = 'hidden';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		toast.success('CSV exported successfully');
	}

	async function generateComprehensivePDFReport() {
		pdfLoading = true;
		try {
			const doc = new jsPDF();
			let yPos = 20;
			const pageWidth = doc.internal.pageSize.width;
			const pageHeight = doc.internal.pageSize.height;
			const margin = 15;
			const contentWidth = pageWidth - 2 * margin;

			// Helper function to add new page if needed
			const checkAddPage = (requiredSpace: number) => {
				if (yPos + requiredSpace > pageHeight - margin) {
					doc.addPage();
					yPos = margin;
					return true;
				}
				return false;
			};

			// Title Page - Styled professionally
			// Add a colored header bar
			doc.setFillColor(59, 130, 246); // Blue color
			doc.rect(0, 0, pageWidth, 50, 'F');
			
			// Title
			doc.setTextColor(255, 255, 255); // White text
			doc.setFontSize(28);
			doc.setFont('helvetica', 'bold');
			doc.text('SEMS Analytics Report', pageWidth / 2, 25, { align: 'center' });
			
			// Subtitle
			doc.setFontSize(12);
			doc.setFont('helvetica', 'normal');
			doc.text('Comprehensive Event Management System Analysis', pageWidth / 2, 38, { align: 'center' });
			
			// Reset text color
			doc.setTextColor(0, 0, 0);
			
			// Report information box
			yPos = 70;
			doc.setFillColor(249, 250, 251); // Light gray background
			doc.roundedRect(margin, yPos, contentWidth, 50, 3, 3, 'F');
			
			yPos += 12;
			doc.setFontSize(11);
			doc.setFont('helvetica', 'bold');
			doc.text('Report Period:', margin + 10, yPos);
			doc.setFont('helvetica', 'normal');
			
			// Format period based on input fields (avoiding timezone issues)
			const formatDateForPDF = (dateStr: string) => {
				if (!dateStr) return 'N/A';
				// Parse the date string as local date to avoid timezone shift
				const [year, month, day] = dateStr.split('-').map(Number);
				const date = new Date(year, month - 1, day);
				return date.toLocaleDateString('en-US', { 
					year: 'numeric', 
					month: 'long', 
					day: 'numeric' 
				});
			};
			
			const periodText = startDate && endDate 
				? `${formatDateForPDF(startDate)} to ${formatDateForPDF(endDate)}`
				: 'All available data';
			doc.text(periodText, margin + 45, yPos);
			
			yPos += 10;
			doc.setFont('helvetica', 'bold');
			doc.text('Organisation:', margin + 10, yPos);
			doc.setFont('helvetica', 'normal');
			const orgText = selectedOrganisation
				? organisations.find((o) => o.organisation_id === selectedOrganisation)?.name || 'Unknown'
				: 'All Organisations';
			doc.text(orgText, margin + 45, yPos);
			
			yPos += 10;
			doc.setFont('helvetica', 'bold');
			doc.text('Generated:', margin + 10, yPos);
			doc.setFont('helvetica', 'normal');
			doc.text(new Date().toLocaleString('en-US', { 
				year: 'numeric', 
				month: 'long', 
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			}), margin + 45, yPos);
			
			// Executive Summary
			doc.addPage();
			yPos = margin;
			doc.setFontSize(16);
			doc.setFont('helvetica', 'bold');
			doc.text('Executive Summary', margin, yPos);
			yPos += 10;

			if (overview) {
				doc.setFontSize(10);
				doc.setFont('helvetica', 'normal');
				
				const summaryData = [
					['Metric', 'Value', 'Description'],
					['Total Events', overview.totalEvents.toString(), 'Events held in selected period'],
					['Total Registrations', overview.totalRegistrations.toString(), 'Total event registrations'],
					['Total Users', overview.totalUsers.toString(), 'Active system users'],
					['Total Organisations', overview.totalOrganisations.toString(), 'Active organisations'],
					['Avg Attendance Rate', `${overview.averageAttendanceRate.toFixed(2)}%`, 'Average event attendance rate']
				];

				autoTable(doc, {
					startY: yPos,
					head: [summaryData[0]],
					body: summaryData.slice(1),
					theme: 'grid',
					headStyles: { fillColor: [59, 130, 246] },
					margin: { left: margin, right: margin }
				});

				yPos = (doc as any).lastAutoTable.finalY + 15;
			}

			// Event Analytics
			if (eventAnalytics.length > 0) {
				checkAddPage(20);
				doc.setFontSize(16);
				doc.setFont('helvetica', 'bold');
				doc.text('Event Performance Analysis', margin, yPos);
				yPos += 10;

				const eventData = eventAnalytics.map(event => [
					event.eventName.substring(0, 30) + (event.eventName.length > 30 ? '...' : ''),
					event.organisationName.substring(0, 20),
					event.registrationCount.toString(),
					event.attendanceCount.toString(),
					`${event.attendanceRate.toFixed(1)}%`,
					event.capacity?.toString() || 'N/A',
					new Date(event.startDate).toLocaleDateString()
				]);

				autoTable(doc, {
					startY: yPos,
					head: [['Event', 'Organisation', 'Reg', 'Att', 'Rate', 'Cap', 'Date']],
					body: eventData,
					theme: 'striped',
					headStyles: { fillColor: [34, 197, 94] },
					margin: { left: margin, right: margin },
					styles: { fontSize: 8 }
				});

				yPos = (doc as any).lastAutoTable.finalY + 15;

				// Event Statistics - Convert to table format
				checkAddPage(40);
				doc.setFontSize(14);
				doc.setFont('helvetica', 'bold');
				doc.text('Event Statistics Summary', margin, yPos);
				yPos += 7;

				const totalRegistrations = eventAnalytics.reduce((sum, e) => sum + e.registrationCount, 0);
				const totalAttendance = eventAnalytics.reduce((sum, e) => sum + e.attendanceCount, 0);
				const avgAttendanceRate = totalRegistrations > 0 ? (totalAttendance / totalRegistrations * 100) : 0;
				const topEvent = eventAnalytics.reduce((max, e) => e.registrationCount > max.registrationCount ? e : max, eventAnalytics[0]);
				const avgRegistrationsPerEvent = eventAnalytics.length > 0 ? (totalRegistrations / eventAnalytics.length) : 0;
				const avgAttendancePerEvent = eventAnalytics.length > 0 ? (totalAttendance / eventAnalytics.length) : 0;

				const statsData = [
					['Metric', 'Value'],
					['Total Events', eventAnalytics.length.toString()],
					['Total Registrations', totalRegistrations.toString()],
					['Total Attendance', totalAttendance.toString()],
					['Overall Attendance Rate', `${avgAttendanceRate.toFixed(2)}%`],
					['Average Registrations per Event', avgRegistrationsPerEvent.toFixed(2)],
					['Average Attendance per Event', avgAttendancePerEvent.toFixed(2)],
					['Top Event by Registrations', topEvent.eventName],
					['Top Event Registration Count', topEvent.registrationCount.toString()]
				];

				autoTable(doc, {
					startY: yPos,
					head: [statsData[0]],
					body: statsData.slice(1),
					theme: 'grid',
					headStyles: { fillColor: [34, 197, 94] },
					margin: { left: margin, right: margin }
				});

				yPos = (doc as any).lastAutoTable.finalY + 15;
			}

			// Monthly Statistics
			if (monthlyStats.length > 0) {
				checkAddPage(20);
				doc.setFontSize(16);
				doc.setFont('helvetica', 'bold');
				doc.text('Monthly Activity Trends', margin, yPos);
				yPos += 10;

				const monthlyData = monthlyStats.map(month => [
					`${month.month} ${month.year}`,
					month.eventCount.toString(),
					month.registrationCount.toString(),
					month.attendanceCount.toString(),
					month.registrationCount > 0 
						? `${((month.attendanceCount / month.registrationCount) * 100).toFixed(1)}%`
						: '0%'
				]);

				autoTable(doc, {
					startY: yPos,
					head: [['Month', 'Events', 'Registrations', 'Attendance', 'Rate']],
					body: monthlyData,
					theme: 'grid',
					headStyles: { fillColor: [168, 85, 247] },
					margin: { left: margin, right: margin }
				});

				yPos = (doc as any).lastAutoTable.finalY + 15;
			}

			// Organisation Statistics
			if (organisationStats.length > 0) {
				checkAddPage(20);
				doc.setFontSize(16);
				doc.setFont('helvetica', 'bold');
				doc.text('Organisation Performance', margin, yPos);
				yPos += 10;

				const orgData = organisationStats.map(org => [
					org.organisationName.substring(0, 30),
					org.eventCount.toString(),
					org.memberCount.toString(),
					org.totalRegistrations.toString(),
					org.totalAttendance.toString(),
					`${org.averageAttendanceRate.toFixed(1)}%`
				]);

				autoTable(doc, {
					startY: yPos,
					head: [['Organisation', 'Events', 'Members', 'Reg', 'Att', 'Rate']],
					body: orgData,
					theme: 'striped',
					headStyles: { fillColor: [239, 68, 68] },
					margin: { left: margin, right: margin },
					styles: { fontSize: 9 }
				});

				yPos = (doc as any).lastAutoTable.finalY + 15;

				// Organisation Performance Summary - Convert to table format
				checkAddPage(30);
				doc.setFontSize(14);
				doc.setFont('helvetica', 'bold');
				doc.text('Organisation Performance Summary', margin, yPos);
				yPos += 7;

				const totalOrgEvents = organisationStats.reduce((sum, org) => sum + org.eventCount, 0);
				const totalOrgRegistrations = organisationStats.reduce((sum, org) => sum + org.totalRegistrations, 0);
				const totalOrgAttendance = organisationStats.reduce((sum, org) => sum + org.totalAttendance, 0);
				const avgOrgAttendanceRate = organisationStats.length > 0
					? organisationStats.reduce((sum, org) => sum + org.averageAttendanceRate, 0) / organisationStats.length
					: 0;
				const mostActiveOrg = organisationStats.reduce((max, org) => org.eventCount > max.eventCount ? org : max, organisationStats[0]);
				const bestAttendanceOrg = organisationStats.reduce((max, org) => org.averageAttendanceRate > max.averageAttendanceRate ? org : max, organisationStats[0]);

				const orgSummaryData = [
					['Metric', 'Value'],
					['Total Active Organisations', organisationStats.length.toString()],
					['Total Events Hosted', totalOrgEvents.toString()],
					['Total Registrations', totalOrgRegistrations.toString()],
					['Total Attendance', totalOrgAttendance.toString()],
					['Average Attendance Rate', `${avgOrgAttendanceRate.toFixed(2)}%`],
					['Most Active Organisation', mostActiveOrg.organisationName],
					['Most Active Organisation Events', mostActiveOrg.eventCount.toString()],
					['Best Attendance Rate Organisation', bestAttendanceOrg.organisationName],
					['Best Attendance Rate', `${bestAttendanceOrg.averageAttendanceRate.toFixed(2)}%`]
				];

				autoTable(doc, {
					startY: yPos,
					head: [orgSummaryData[0]],
					body: orgSummaryData.slice(1),
					theme: 'grid',
					headStyles: { fillColor: [239, 68, 68] },
					margin: { left: margin, right: margin }
				});

				yPos = (doc as any).lastAutoTable.finalY + 15;
			}

			// User Insights
			if (userInsights) {
				checkAddPage(20);
				doc.setFontSize(16);
				doc.setFont('helvetica', 'bold');
				doc.text('User Insights & Demographics', margin, yPos);
				yPos += 10;

				// Key Metrics
				const userMetricsData = [
					['Metric', 'Value'],
					['Total Active Users', userInsights.totalActiveUsers.toString()],
					['New Users (Period)', userInsights.newUsersThisPeriod.toString()],
					['Engagement Rate', `${userInsights.userEngagementRate.toFixed(2)}%`],
					['Avg Events per User', userInsights.averageEventsPerUser.toFixed(2)]
				];

				autoTable(doc, {
					startY: yPos,
					head: [userMetricsData[0]],
					body: userMetricsData.slice(1),
					theme: 'grid',
					headStyles: { fillColor: [59, 130, 246] },
					margin: { left: margin, right: margin }
				});

				yPos = (doc as any).lastAutoTable.finalY + 15;

				// Study Programs
				if (userInsights.topStudyPrograms.length > 0) {
					checkAddPage(20);
					doc.setFontSize(14);
					doc.setFont('helvetica', 'bold');
					doc.text('Study Program Distribution', margin, yPos);
					yPos += 7;

					const programData = userInsights.topStudyPrograms.map(program => [
						program.programName,
						program.userCount.toString(),
						`${program.percentage.toFixed(1)}%`
					]);

					autoTable(doc, {
						startY: yPos,
						head: [['Program', 'Users', 'Percentage']],
						body: programData,
						theme: 'striped',
						headStyles: { fillColor: [34, 197, 94] },
						margin: { left: margin, right: margin }
					});

					yPos = (doc as any).lastAutoTable.finalY + 15;
				}

				// User Roles
				if (userInsights.usersByRole.length > 0) {
					checkAddPage(20);
					doc.setFontSize(14);
					doc.setFont('helvetica', 'bold');
					doc.text('User Role Distribution', margin, yPos);
					yPos += 7;

					const roleData = userInsights.usersByRole.map(role => [
						role.roleName,
						role.userCount.toString(),
						`${role.percentage.toFixed(1)}%`
					]);

					autoTable(doc, {
						startY: yPos,
						head: [['Role', 'Users', 'Percentage']],
						body: roleData,
						theme: 'striped',
						headStyles: { fillColor: [168, 85, 247] },
						margin: { left: margin, right: margin }
					});

					yPos = (doc as any).lastAutoTable.finalY + 15;
				}

				// Most Engaged Users
				if (userInsights.mostEngagedUsers.length > 0) {
					checkAddPage(20);
					doc.setFontSize(14);
					doc.setFont('helvetica', 'bold');
					doc.text('Most Engaged Users', margin, yPos);
					yPos += 7;

					const engagedData = userInsights.mostEngagedUsers.slice(0, 10).map(user => [
						user.userName,
						user.eventsRegistered.toString(),
						user.eventsAttended.toString(),
						`${user.attendanceRate.toFixed(1)}%`
					]);

					autoTable(doc, {
						startY: yPos,
						head: [['User', 'Registered', 'Attended', 'Rate']],
						body: engagedData,
						theme: 'grid',
						headStyles: { fillColor: [239, 68, 68] },
						margin: { left: margin, right: margin }
					});

					yPos = (doc as any).lastAutoTable.finalY + 15;
				}

				// Enrollment Year Distribution
				if (userInsights.usersByEnrollmentYear && userInsights.usersByEnrollmentYear.length > 0) {
					checkAddPage(20);
					doc.setFontSize(14);
					doc.setFont('helvetica', 'bold');
					doc.text('Enrollment Year Distribution', margin, yPos);
					yPos += 7;

					const enrollmentData = userInsights.usersByEnrollmentYear.map(year => [
						year.enrollmentYear || 'Not Specified',
						year.userCount.toString(),
						`${year.percentage.toFixed(1)}%`
					]);

					autoTable(doc, {
						startY: yPos,
						head: [['Year', 'Users', 'Percentage']],
						body: enrollmentData,
						theme: 'striped',
						headStyles: { fillColor: [34, 197, 94] },
						margin: { left: margin, right: margin }
					});

					yPos = (doc as any).lastAutoTable.finalY + 15;
				}

				// Engagement Trends
				if (userInsights.engagementTrends.length > 0) {
					checkAddPage(20);
					doc.setFontSize(14);
					doc.setFont('helvetica', 'bold');
					doc.text('Monthly Engagement Trends', margin, yPos);
					yPos += 7;

					const trendsData = userInsights.engagementTrends.slice(-12).map(trend => [
						new Date(trend.period + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
						trend.activeUsers.toString(),
						trend.newRegistrations.toString(),
						trend.totalAttendance.toString(),
						trend.newRegistrations > 0 
							? `${((trend.totalAttendance / trend.newRegistrations) * 100).toFixed(1)}%`
							: '0%'
					]);

					autoTable(doc, {
						startY: yPos,
						head: [['Month', 'Active', 'Reg', 'Att', 'Rate']],
						body: trendsData,
						theme: 'grid',
						headStyles: { fillColor: [168, 85, 247] },
						margin: { left: margin, right: margin },
						styles: { fontSize: 8 }
					});

					yPos = (doc as any).lastAutoTable.finalY + 15;
				}
			}

			// Overall Summary Statistics
			doc.addPage();
			yPos = margin;
			doc.setFontSize(16);
			doc.setFont('helvetica', 'bold');
			doc.text('Overall Summary Statistics', margin, yPos);
			yPos += 10;

			// Calculate comprehensive summary data
			const summaryStats: string[][] = [['Category', 'Metric', 'Value']];

			// Overview stats
			if (overview) {
				summaryStats.push(['System', 'Total Organisations', overview.totalOrganisations.toString()]);
				summaryStats.push(['System', 'Total Events', overview.totalEvents.toString()]);
				summaryStats.push(['System', 'Total Registrations', overview.totalRegistrations.toString()]);
				summaryStats.push(['System', 'Total Users', overview.totalUsers.toString()]);
				summaryStats.push(['System', 'Average Attendance Rate', `${overview.averageAttendanceRate.toFixed(2)}%`]);
			}

			// Event stats
			if (eventAnalytics.length > 0) {
				const totalEventReg = eventAnalytics.reduce((sum, e) => sum + e.registrationCount, 0);
				const totalEventAtt = eventAnalytics.reduce((sum, e) => sum + e.attendanceCount, 0);
				summaryStats.push(['Events', 'Total Events Analyzed', eventAnalytics.length.toString()]);
				summaryStats.push(['Events', 'Total Event Registrations', totalEventReg.toString()]);
				summaryStats.push(['Events', 'Total Event Attendance', totalEventAtt.toString()]);
			}

			// Monthly stats
			if (monthlyStats.length > 0) {
				const totalMonthlyEvents = monthlyStats.reduce((sum, m) => sum + m.eventCount, 0);
				const totalMonthlyReg = monthlyStats.reduce((sum, m) => sum + m.registrationCount, 0);
				const totalMonthlyAtt = monthlyStats.reduce((sum, m) => sum + m.attendanceCount, 0);
				summaryStats.push(['Monthly', 'Months Covered', monthlyStats.length.toString()]);
				summaryStats.push(['Monthly', 'Total Monthly Events', totalMonthlyEvents.toString()]);
				summaryStats.push(['Monthly', 'Total Monthly Registrations', totalMonthlyReg.toString()]);
				summaryStats.push(['Monthly', 'Total Monthly Attendance', totalMonthlyAtt.toString()]);
			}

			// Organisation stats
			if (organisationStats.length > 0) {
				const totalOrgEvents = organisationStats.reduce((sum, o) => sum + o.eventCount, 0);
				const totalOrgMembers = organisationStats.reduce((sum, o) => sum + o.memberCount, 0);
				summaryStats.push(['Organisations', 'Active Organisations', organisationStats.length.toString()]);
				summaryStats.push(['Organisations', 'Total Organisation Events', totalOrgEvents.toString()]);
				summaryStats.push(['Organisations', 'Total Organisation Members', totalOrgMembers.toString()]);
			}

			// User stats
			if (userInsights) {
				summaryStats.push(['Users', 'Total Active Users', userInsights.totalActiveUsers.toString()]);
				summaryStats.push(['Users', 'New Users (Period)', userInsights.newUsersThisPeriod.toString()]);
				summaryStats.push(['Users', 'User Engagement Rate', `${userInsights.userEngagementRate.toFixed(2)}%`]);
				summaryStats.push(['Users', 'Average Events per User', userInsights.averageEventsPerUser.toFixed(2)]);
			}

			autoTable(doc, {
				startY: yPos,
				head: [summaryStats[0]],
				body: summaryStats.slice(1),
				theme: 'grid',
				headStyles: { fillColor: [59, 130, 246] },
				margin: { left: margin, right: margin },
				columnStyles: {
					0: { cellWidth: 50 },
					1: { cellWidth: 80 }
				}
			});

			yPos = (doc as any).lastAutoTable.finalY + 10;

			// Footer on last page
			yPos = pageHeight - margin;
			doc.setFontSize(8);
			doc.setTextColor(128, 128, 128);
			doc.text(`SEMS Analytics Report - ${new Date().toLocaleDateString()}`, pageWidth / 2, yPos, { align: 'center' });

			// Save the PDF
			const fileName = `SEMS_Comprehensive_Report_${new Date().toISOString().split('T')[0]}.pdf`;
			doc.save(fileName);

			toast.success('Comprehensive PDF report generated successfully');
		} catch (error) {
			console.error('Error generating PDF report:', error);
			toast.error('Failed to generate PDF report');
		} finally {
			pdfLoading = false;
		}
	}

	function formatNumber(num: number): string {
		return new Intl.NumberFormat().format(num);
	}

	function formatPercentage(num: number): string {
		return `${num.toFixed(1)}%`;
	}

	// Helper function to format date without timezone issues
	function formatDateDisplay(dateStr: string): string {
		if (!dateStr) return 'N/A';
		// Parse the date string as local date to avoid timezone shift
		const [year, month, day] = dateStr.split('-').map(Number);
		const date = new Date(year, month - 1, day);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Analytics - SEMS</title>
	<meta
		name="description"
		content="View analytics and insights about student events and participation."
	/>
	<meta name="keywords" content="analytics, reports, event statistics, participation data" />
	<meta property="og:title" content="Analytics - SEMS" />
	<meta
		property="og:description"
		content="View analytics and insights about student events and participation."
	/>
	<meta property="og:type" content="website" />
	<meta name="robots" content="noindex, nofollow" />
	<link rel="canonical" href="/analytics" />
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
	<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
		<div>
			<h1 class="text-3xl font-bold text-gray-900">Analytics & Reporting</h1>
			<p class="mt-2 text-gray-600">
				Comprehensive insights into event performance and user engagement.
			</p>
		</div>
		<div class="flex gap-2 sm:flex-shrink-0">
			<Button
				variant="outline"
				onclick={exportToCSV}
				disabled={eventAnalytics.length === 0}
				class="flex-1 sm:w-auto sm:flex-initial"
			>
				<FileSpreadsheet class="mr-2 h-4 w-4" />
				Export CSV
			</Button>
			<Button
				variant="outline"
				onclick={exportToExcel}
				disabled={exportLoading || (!overview && eventAnalytics.length === 0 && monthlyStats.length === 0 && organisationStats.length === 0 && !userInsights)}
				class="flex-1 sm:w-auto sm:flex-initial"
			>
				{#if exportLoading}
					<div class="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-gray-900"></div>
				{:else}
					<Download class="mr-2 h-4 w-4" />
				{/if}
				Export Excel
			</Button>
		</div>
	</div>

	<!-- Filters -->
	<Card class="mt-6">
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<Filter class="h-5 w-5" />
				Filters
			</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-4 lg:grid-cols-5">
				<div class="md:col-span-1">
					<Label for="start-date">Start Date</Label>
					<Popover.Root bind:open={openStartDate}>
						<Popover.Trigger id="start-date">
							{#snippet child({ props })}
								<Button
									{...props}
									variant="outline"
									class="mt-2 w-full justify-between font-normal"
								>
									{startDatePicker
										? startDatePicker.toDate(getLocalTimeZone()).toLocaleDateString('en-US', {
												day: '2-digit',
												month: 'short',
												year: 'numeric'
											})
										: 'Select start date'}
									<CalendarIcon class="h-4 w-4" />
								</Button>
							{/snippet}
						</Popover.Trigger>
						<Popover.Content class="w-auto overflow-hidden p-0" align="start">
							<Calendar
								type="single"
								bind:value={startDatePicker}
								captionLayout="dropdown"
								onValueChange={handleStartDateChange}
							/>
						</Popover.Content>
					</Popover.Root>
				</div>
				<div class="md:col-span-1">
					<Label for="end-date">End Date</Label>
					<Popover.Root bind:open={openEndDate}>
						<Popover.Trigger id="end-date">
							{#snippet child({ props })}
								<Button
									{...props}
									variant="outline"
									class="mt-2 w-full justify-between font-normal"
								>
									{endDatePicker
										? endDatePicker.toDate(getLocalTimeZone()).toLocaleDateString('en-US', {
												day: '2-digit',
												month: 'short',
												year: 'numeric'
											})
										: 'Select end date'}
									<CalendarIcon class="h-4 w-4" />
								</Button>
							{/snippet}
						</Popover.Trigger>
						<Popover.Content class="w-auto overflow-hidden p-0" align="start">
							<Calendar
								type="single"
								bind:value={endDatePicker}
								captionLayout="dropdown"
								onValueChange={handleEndDateChange}
							/>
						</Popover.Content>
					</Popover.Root>
				</div>
				<div class="md:col-span-1">
					<Label for="organisation">Organisation</Label>
					<Select.Root type="single" name="organisation-filter" bind:value={selectedOrganisation}>
						<Select.Trigger class="mt-2 w-full">
							{selectedOrganisation
								? organisations.find((o) => o.organisation_id === selectedOrganisation)?.name ||
									'Unknown'
								: 'All Organisations'}
						</Select.Trigger>
						<Select.Content>
							<Select.Group>
								<Select.Item value="" label="All Organisations">All Organisations</Select.Item>
								{#each organisations as org}
									<Select.Item value={org.organisation_id} label={org.name}>{org.name}</Select.Item>
								{/each}
							</Select.Group>
						</Select.Content>
					</Select.Root>
				</div>
				<div class="flex items-end md:col-span-1">
					<Button variant="outline" onclick={clearFilters} class="w-full">Reset</Button>
				</div>
				<div class="flex items-end md:col-span-1">
					<Button onclick={handleSearch} disabled={loading} class="w-full">
						{#if loading}
							<Search class="mr-2 h-4 w-4 animate-spin" />
						{:else}
							<Search class="mr-2 h-4 w-4" />
						{/if}
						Search
					</Button>
				</div>
			</div>
		</CardContent>
	</Card>

	{#if loading}
		<!-- Loading Skeletons -->
		<div class="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			{#each Array(4) as _}
				<Card>
					<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
						<Skeleton class="h-4 w-[100px]" />
						<Skeleton class="h-4 w-4" />
					</CardHeader>
					<CardContent>
						<Skeleton class="h-8 w-[60px]" />
						<Skeleton class="mt-2 h-4 w-[120px]" />
					</CardContent>
				</Card>
			{/each}
		</div>
	{:else if overview}
		<!-- Overview Cards -->
		<div class="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			<Card>
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">Active Organisations</CardTitle>
					<Building class="text-muted-foreground h-4 w-4" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold">{formatNumber(overview.totalOrganisations)}</div>
					<p class="text-muted-foreground text-xs">Registered organisations</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">Total Events</CardTitle>
					<CalendarIcon class="text-muted-foreground h-4 w-4" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold">{formatNumber(overview.totalEvents)}</div>
					<p class="text-muted-foreground text-xs">Events in selected period</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">Total Registrations</CardTitle>
					<Users class="text-muted-foreground h-4 w-4" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold">{formatNumber(overview.totalRegistrations)}</div>
					<p class="text-muted-foreground text-xs">Across all events</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">Average Attendance</CardTitle>
					<TrendingUp class="text-muted-foreground h-4 w-4" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold">{formatPercentage(overview.averageAttendanceRate)}</div>
					<p class="text-muted-foreground text-xs">
						{#if overview.averageAttendanceRate >= 75}
							<span class="text-green-600">Excellent attendance</span>
						{:else if overview.averageAttendanceRate >= 50}
							<span class="text-yellow-600">Good attendance</span>
						{:else}
							<span class="text-red-600">Needs improvement</span>
						{/if}
					</p>
				</CardContent>
			</Card>
		</div>

		<!-- Charts and Analytics -->
		<Tabs.Root value="monthly" class="mt-8">
			<Tabs.List class="grid w-full grid-cols-5">
				<Tabs.Trigger value="monthly" class="flex items-center gap-2">
					<TrendingUp class="h-4 w-4" />
					<span class="hidden sm:inline">Monthly Trends</span>
				</Tabs.Trigger>
				<Tabs.Trigger value="events" class="flex items-center gap-2">
					<BarChart3 class="h-4 w-4" />
					<span class="hidden sm:inline">Event Performance</span>
				</Tabs.Trigger>
				<Tabs.Trigger value="organisations" class="flex items-center gap-2">
					<Building class="h-4 w-4" />
					<span class="hidden sm:inline">Organisation Stats</span>
				</Tabs.Trigger>
				<Tabs.Trigger value="insights" class="flex items-center gap-2">
					<Users class="h-4 w-4" />
					<span class="hidden sm:inline">User Insights</span>
				</Tabs.Trigger>
				<Tabs.Trigger value="reports" class="flex items-center gap-2">
					<FileText class="h-4 w-4" />
					<span class="hidden sm:inline">PDF Reports</span>
				</Tabs.Trigger>
			</Tabs.List>

			<Tabs.Content value="monthly">
				<Card>
					<CardHeader>
						<CardTitle>Monthly Activity Trends</CardTitle>
						<CardDescription>
							Event creation, registrations, and attendance over time.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{#if monthlyStats.length > 0}
							<div class="space-y-6">
								<div class="grid gap-4 md:grid-cols-3">
									<div class="bg-muted/25 rounded-lg p-4">
										<h4 class="text-muted-foreground text-sm font-medium">Total Events</h4>
										<p class="text-2xl font-bold">
											{monthlyStats.reduce((sum, month) => sum + month.eventCount, 0)}
										</p>
									</div>
									<div class="bg-muted/25 rounded-lg p-4">
										<h4 class="text-muted-foreground text-sm font-medium">Total Registrations</h4>
										<p class="text-2xl font-bold">
											{monthlyStats.reduce((sum, month) => sum + month.registrationCount, 0)}
										</p>
									</div>
									<div class="bg-muted/25 rounded-lg p-4">
										<h4 class="text-muted-foreground text-sm font-medium">Total Attendance</h4>
										<p class="text-2xl font-bold">
											{monthlyStats.reduce((sum, month) => sum + month.attendanceCount, 0)}
										</p>
									</div>
								</div>

								<div class="space-y-4">
									<h4 class="text-lg font-semibold">Monthly Breakdown</h4>
									<div class="rounded-md border">
										<div class="overflow-x-auto">
											<table class="w-full text-sm">
												<thead>
													<tr class="bg-muted/50 border-b">
														<th class="p-3 text-left font-medium">Month</th>
														<th class="p-3 text-center font-medium">Events</th>
														<th class="p-3 text-center font-medium">Registrations</th>
														<th class="p-3 text-center font-medium">Attendance</th>
														<th class="p-3 text-center font-medium">Attendance Rate</th>
														<th class="p-3 text-center font-medium">Avg per Event</th>
													</tr>
												</thead>
												<tbody>
													{#each monthlyStats.toSorted((a, b) => new Date(`${a.year}-${a.month}-01`).getTime() - new Date(`${b.year}-${b.month}-01`).getTime()) as month}
														<tr class="hover:bg-muted/25 border-b">
															<td class="p-3 font-medium">{month.month} {month.year}</td>
															<td class="p-3 text-center">{month.eventCount}</td>
															<td class="p-3 text-center">{month.registrationCount}</td>
															<td class="p-3 text-center">{month.attendanceCount}</td>
															<td class="p-3 text-center">
																<Badge
																	variant={month.registrationCount > 0 &&
																	(month.attendanceCount / month.registrationCount) * 100 >= 75
																		? 'default'
																		: month.registrationCount > 0 &&
																			  (month.attendanceCount / month.registrationCount) * 100 >=
																					50
																			? 'secondary'
																			: 'destructive'}
																>
																	{month.registrationCount > 0
																		? (
																				(month.attendanceCount / month.registrationCount) *
																				100
																			).toFixed(1)
																		: 0}%
																</Badge>
															</td>
															<td class="text-muted-foreground p-3 text-center">
																{month.eventCount > 0
																	? (month.registrationCount / month.eventCount).toFixed(1)
																	: '0'}
															</td>
														</tr>
													{/each}
												</tbody>
											</table>
										</div>
									</div>
								</div>
							</div>
						{:else}
							<div class="text-muted-foreground flex h-[400px] items-center justify-center">
								No data available for the selected period
							</div>
						{/if}
					</CardContent>
				</Card>
			</Tabs.Content>

			<Tabs.Content value="events">
				<Card>
					<CardHeader>
						<CardTitle>Event Performance Analysis</CardTitle>
						<CardDescription>Detailed breakdown of individual event metrics.</CardDescription>
					</CardHeader>
					<CardContent>
						{#if eventAnalytics.length > 0}
							<div class="space-y-4">
								<!-- Event Analytics Table -->
								<div class="rounded-md border">
									<div class="overflow-x-auto">
										<table class="w-full text-sm">
											<thead>
												<tr class="bg-muted/50 border-b">
													<th class="p-3 text-left font-medium">Event</th>
													<th class="p-3 text-left font-medium">Organisation</th>
													<th class="p-3 text-center font-medium">Registrations</th>
													<th class="p-3 text-center font-medium">Attendance</th>
													<th class="p-3 text-center font-medium">Rate</th>
													<th class="p-3 text-center font-medium">Capacity</th>
													<th class="p-3 text-left font-medium">Date</th>
													<th class="p-3 text-left font-medium">Status</th>
												</tr>
											</thead>
											<tbody>
												{#each eventAnalytics.slice(0, 10) as event}
													<tr class="hover:bg-muted/25 border-b">
														<td class="p-3 font-medium">{event.eventName}</td>
														<td class="text-muted-foreground p-3">{event.organisationName}</td>
														<td class="p-3 text-center">{event.registrationCount}</td>
														<td class="p-3 text-center">{event.attendanceCount}</td>
														<td class="p-3 text-center">
															<Badge
																variant={event.attendanceRate >= 75
																	? 'default'
																	: event.attendanceRate >= 50
																		? 'secondary'
																		: 'destructive'}
															>
																{formatPercentage(event.attendanceRate)}
															</Badge>
														</td>
														<td class="p-3 text-center">{event.capacity || 'N/A'}</td>
														<td class="text-muted-foreground p-3">
															{new Date(event.startDate).toLocaleDateString()}
														</td>
														<td class="p-3">
															<Badge variant="outline">{event.eventState}</Badge>
														</td>
													</tr>
												{/each}
											</tbody>
										</table>
									</div>
								</div>
								{#if eventAnalytics.length > 10}
									<p class="text-muted-foreground text-center text-sm">
										Showing top 10 events. Export to see all {eventAnalytics.length} events.
									</p>
								{/if}
							</div>
						{:else}
							<div class="text-muted-foreground flex h-[400px] items-center justify-center">
								No events found for the selected criteria
							</div>
						{/if}
					</CardContent>
				</Card>
			</Tabs.Content>

			<Tabs.Content value="organisations">
				<Card>
					<CardHeader>
						<CardTitle>Organisation Performance</CardTitle>
						<CardDescription>Event hosting and engagement metrics by organisation.</CardDescription>
					</CardHeader>
					<CardContent>
						{#if organisationStats.length > 0}
							<div class="space-y-6">
								<!-- Summary Stats -->
								<div class="grid gap-4 md:grid-cols-3">
									<div class="bg-muted/25 rounded-lg p-4">
										<h4 class="text-muted-foreground text-sm font-medium">Active Organisations</h4>
										<p class="text-2xl font-bold">{organisationStats.length}</p>
									</div>
									<div class="bg-muted/25 rounded-lg p-4">
										<h4 class="text-muted-foreground text-sm font-medium">Total Events</h4>
										<p class="text-2xl font-bold">
											{organisationStats.reduce((sum, org) => sum + org.eventCount, 0)}
										</p>
									</div>
									<div class="bg-muted/25 rounded-lg p-4">
										<h4 class="text-muted-foreground text-sm font-medium">Avg Attendance Rate</h4>
										<p class="text-2xl font-bold">
											{organisationStats.length > 0
												? formatPercentage(
														organisationStats.reduce(
															(sum, org) => sum + org.averageAttendanceRate,
															0
														) / organisationStats.length
													)
												: '0%'}
										</p>
									</div>
								</div>

								<!-- Organisation Performance Table -->
								<div class="space-y-4">
									<h4 class="text-lg font-semibold">Organisation Performance Table</h4>
									<div class="rounded-md border">
										<div class="overflow-x-auto">
											<table class="w-full text-sm">
												<thead>
													<tr class="bg-muted/50 border-b">
														<th class="p-3 text-left font-medium">Organisation</th>
														<th class="p-3 text-center font-medium">Events</th>
														<th class="p-3 text-center font-medium">Members</th>
														<th class="p-3 text-center font-medium">Registrations</th>
														<th class="p-3 text-center font-medium">Attendance</th>
														<th class="p-3 text-center font-medium">Attendance Rate</th>
														<th class="p-3 text-center font-medium">Avg per Event</th>
													</tr>
												</thead>
												<tbody>
													{#each organisationStats.toSorted((a, b) => b.eventCount - a.eventCount) as org}
														<tr class="hover:bg-muted/25 border-b">
															<td class="p-3 font-medium">{org.organisationName}</td>
															<td class="p-3 text-center">{org.eventCount}</td>
															<td class="p-3 text-center">{org.memberCount}</td>
															<td class="p-3 text-center">{org.totalRegistrations}</td>
															<td class="p-3 text-center">{org.totalAttendance}</td>
															<td class="p-3 text-center">
																<Badge
																	variant={org.averageAttendanceRate >= 75
																		? 'default'
																		: org.averageAttendanceRate >= 50
																			? 'secondary'
																			: 'destructive'}
																>
																	{formatPercentage(org.averageAttendanceRate)}
																</Badge>
															</td>
															<td class="text-muted-foreground p-3 text-center">
																{org.eventCount > 0
																	? (org.totalRegistrations / org.eventCount).toFixed(1)
																	: '0'}
															</td>
														</tr>
													{/each}
												</tbody>
											</table>
										</div>
									</div>
								</div>

								<!-- Quick Insights -->
								<div class="grid gap-6 md:grid-cols-2">
									<!-- Top performing organisations by events -->
									<div class="space-y-4">
										<h4 class="text-lg font-semibold">Most Active (by Events)</h4>
										<div class="space-y-2">
											{#each organisationStats
												.toSorted((a, b) => b.eventCount - a.eventCount)
												.slice(0, 5) as org, index}
												<div class="bg-muted/25 flex items-center justify-between rounded-lg p-3">
													<div class="flex items-center gap-3">
														<span
															class="bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
														>
															{index + 1}
														</span>
														<span class="font-medium">{org.organisationName}</span>
													</div>
													<Badge variant="secondary">{org.eventCount} events</Badge>
												</div>
											{/each}
										</div>
									</div>

									<!-- Best attendance rates -->
									<div class="space-y-4">
										<h4 class="text-lg font-semibold">Best Attendance Rates</h4>
										<div class="space-y-2">
											{#each organisationStats
												.filter((org) => org.totalRegistrations > 0)
												.toSorted((a, b) => b.averageAttendanceRate - a.averageAttendanceRate)
												.slice(0, 5) as org, index}
												<div class="bg-muted/25 flex items-center justify-between rounded-lg p-3">
													<div class="flex items-center gap-3">
														<span
															class="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white"
														>
															{index + 1}
														</span>
														<span class="font-medium">{org.organisationName}</span>
													</div>
													<Badge
														variant={org.averageAttendanceRate >= 75
															? 'default'
															: org.averageAttendanceRate >= 50
																? 'secondary'
																: 'destructive'}
													>
														{formatPercentage(org.averageAttendanceRate)}
													</Badge>
												</div>
											{/each}
										</div>
									</div>
								</div>
							</div>
						{:else}
							<div class="text-muted-foreground flex h-[400px] items-center justify-center">
								No organisation data available
							</div>
						{/if}
					</CardContent>
				</Card>
			</Tabs.Content>

			<Tabs.Content value="insights">
				<Card>
					<CardHeader>
						<CardTitle>User Insights & Engagement</CardTitle>
						<CardDescription>
							Understanding user behavior, engagement patterns, and demographics.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{#if loading}
							<!-- Loading state -->
							<div class="space-y-6">
								<div class="grid gap-4 md:grid-cols-4">
									{#each Array(4) as _}
										<div class="bg-muted/25 rounded-lg p-4">
											<Skeleton class="mb-2 h-4 w-[100px]" />
											<Skeleton class="mb-2 h-8 w-[60px]" />
											<Skeleton class="h-3 w-[120px]" />
										</div>
									{/each}
								</div>
								<Skeleton class="h-[200px] w-full" />
							</div>
						{:else if userInsights}
							<div class="space-y-8">
								<!-- Key User Metrics -->
								<div class="grid gap-4 md:grid-cols-4">
									<div class="bg-muted/25 rounded-lg p-4">
										<h4 class="text-muted-foreground text-sm font-medium">Active Users</h4>
										<p class="text-2xl font-bold">{formatNumber(userInsights.totalActiveUsers)}</p>
										<p class="text-muted-foreground text-xs">
											{userInsights.userEngagementRate.toFixed(1)}% engagement rate
										</p>
									</div>
									<div class="bg-muted/25 rounded-lg p-4">
										<h4 class="text-muted-foreground text-sm font-medium">New Users</h4>
										<p class="text-2xl font-bold">
											{formatNumber(userInsights.newUsersThisPeriod)}
										</p>
										<p class="text-muted-foreground text-xs">In selected period</p>
									</div>
									<div class="bg-muted/25 rounded-lg p-4">
										<h4 class="text-muted-foreground text-sm font-medium">Avg Events/User</h4>
										<p class="text-2xl font-bold">{userInsights.averageEventsPerUser.toFixed(1)}</p>
										<p class="text-muted-foreground text-xs">Per active user</p>
									</div>
									<div class="bg-muted/25 rounded-lg p-4">
										<h4 class="text-muted-foreground text-sm font-medium">Engagement Level</h4>
										<p class="text-2xl font-bold">
											{userInsights.userEngagementRate >= 75
												? 'High'
												: userInsights.userEngagementRate >= 50
													? 'Good'
													: userInsights.userEngagementRate >= 25
														? 'Fair'
														: 'Low'}
										</p>
										<p class="text-muted-foreground text-xs">
											{userInsights.userEngagementRate.toFixed(1)}% active
										</p>
									</div>
								</div>

								<!-- User Engagement Trends -->
								{#if userInsights.engagementTrends.length > 0}
									<div class="space-y-4">
										<h4 class="text-lg font-semibold">Monthly Engagement Trends</h4>
										<div class="rounded-md border">
											<div class="overflow-x-auto">
												<table class="w-full text-sm">
													<thead>
														<tr class="bg-muted/50 border-b">
															<th class="p-3 text-left font-medium">Month</th>
															<th class="p-3 text-center font-medium">Active Users</th>
															<th class="p-3 text-center font-medium">New Registrations</th>
															<th class="p-3 text-center font-medium">Total Attendance</th>
															<th class="p-3 text-center font-medium">Attendance Rate</th>
															<th class="p-3 text-center font-medium">Trend</th>
														</tr>
													</thead>
													<tbody>
														{#each userInsights.engagementTrends.slice(-6) as trend, index}
															{@const previousTrend =
																index > 0
																	? userInsights.engagementTrends.slice(-6)[index - 1]
																	: null}
															{@const userGrowth = previousTrend
																? trend.activeUsers - previousTrend.activeUsers
																: 0}
															<tr class="hover:bg-muted/25 border-b">
																<td class="p-3 font-medium">
																	{new Date(trend.period + '-01').toLocaleDateString('en-US', {
																		year: 'numeric',
																		month: 'long'
																	})}
																</td>
																<td class="p-3 text-center">{trend.activeUsers}</td>
																<td class="p-3 text-center">{trend.newRegistrations}</td>
																<td class="p-3 text-center">{trend.totalAttendance}</td>
																<td class="p-3 text-center">
																	<Badge
																		variant={trend.newRegistrations > 0 &&
																		(trend.totalAttendance / trend.newRegistrations) * 100 >= 75
																			? 'default'
																			: trend.newRegistrations > 0 &&
																				  (trend.totalAttendance / trend.newRegistrations) * 100 >=
																						50
																				? 'secondary'
																				: 'destructive'}
																	>
																		{trend.newRegistrations > 0
																			? (
																					(trend.totalAttendance / trend.newRegistrations) *
																					100
																				).toFixed(1)
																			: 0}%
																	</Badge>
																</td>
																<td class="p-3 text-center">
																	{#if userGrowth > 0}
																		<Badge variant="default" class="bg-green-600">
																			<TrendingUp class="mr-1 h-3 w-3" />
																			+{userGrowth}
																		</Badge>
																	{:else if userGrowth < 0}
																		<Badge variant="destructive">
																			<TrendingDown class="mr-1 h-3 w-3" />
																			{userGrowth}
																		</Badge>
																	{:else if previousTrend}
																		<Badge variant="secondary">→ Stable</Badge>
																	{:else}
																		<span class="text-muted-foreground text-xs">-</span>
																	{/if}
																</td>
															</tr>
														{/each}
													</tbody>
												</table>
											</div>
										</div>
									</div>
								{/if}

								<!-- User Demographics - Stacked Layout -->
								<div class="space-y-6">
									<!-- Study Program Distribution -->
									{#if userInsights.topStudyPrograms.length > 0}
										<div class="space-y-4">
											<h4 class="text-lg font-semibold">Study Program Distribution</h4>
											<div class="rounded-md border">
												<div class="overflow-x-auto">
													<table class="w-full text-sm">
														<thead>
															<tr class="bg-muted/50 border-b">
																<th class="p-3 text-left font-medium">Program</th>
																<th class="p-3 text-center font-medium">Users</th>
																<th class="p-3 text-center font-medium">Percentage</th>
																<th class="p-3 text-center font-medium">Distribution</th>
															</tr>
														</thead>
														<tbody>
															{#each userInsights.topStudyPrograms as program, index}
																<tr class="hover:bg-muted/25 border-b">
																	<td class="p-3 font-medium">{program.programName}</td>
																	<td class="p-3 text-center">{program.userCount}</td>
																	<td class="p-3 text-center">
																		<Badge variant="outline">{program.percentage.toFixed(1)}%</Badge
																		>
																	</td>
																	<td class="p-3">
																		<div class="h-2 w-full rounded-full bg-gray-200">
																			<div
																				class="h-2 rounded-full bg-blue-600"
																				style="width: {Math.max(program.percentage, 2)}%"
																			></div>
																		</div>
																	</td>
																</tr>
															{/each}
														</tbody>
													</table>
												</div>
											</div>
										</div>
									{:else}
										<div class="space-y-4">
											<h4 class="text-lg font-semibold">Study Program Distribution</h4>
											<div class="bg-muted/25 rounded-lg p-4 text-center">
												<p class="text-muted-foreground text-sm">
													Study program data not available or not configured
												</p>
											</div>
										</div>
									{/if}

									<!-- User Roles Distribution -->
									{#if userInsights.usersByRole.length > 0}
										<div class="space-y-4">
											<h4 class="text-lg font-semibold">User Role Distribution</h4>
											<div class="rounded-md border">
												<div class="overflow-x-auto">
													<table class="w-full text-sm">
														<thead>
															<tr class="bg-muted/50 border-b">
																<th class="p-3 text-left font-medium">Role</th>
																<th class="p-3 text-center font-medium">Users</th>
																<th class="p-3 text-center font-medium">Percentage</th>
																<th class="p-3 text-center font-medium">Distribution</th>
															</tr>
														</thead>
														<tbody>
															{#each userInsights.usersByRole as role, index}
																<tr class="hover:bg-muted/25 border-b">
																	<td class="p-3 font-medium capitalize">{role.roleName}</td>
																	<td class="p-3 text-center">{role.userCount}</td>
																	<td class="p-3 text-center">
																		<Badge variant="outline">{role.percentage.toFixed(1)}%</Badge>
																	</td>
																	<td class="p-3">
																		<div class="h-2 w-full rounded-full bg-gray-200">
																			<div
																				class="h-2 rounded-full bg-green-600"
																				style="width: {Math.max(role.percentage, 2)}%"
																			></div>
																		</div>
																	</td>
																</tr>
															{/each}
														</tbody>
													</table>
												</div>
											</div>
										</div>
									{:else}
										<div class="space-y-4">
											<h4 class="text-lg font-semibold">User Role Distribution</h4>
											<div class="bg-muted/25 rounded-lg p-4 text-center">
												<p class="text-muted-foreground text-sm">No user role data available</p>
											</div>
										</div>
									{/if}

									<!-- Enrollment Year Distribution -->
									{#if userInsights.usersByEnrollmentYear && userInsights.usersByEnrollmentYear.length > 0}
										<div class="space-y-4">
											<h4 class="text-lg font-semibold">Enrollment Year Distribution</h4>
											<div class="rounded-md border">
												<div class="overflow-x-auto">
													<table class="w-full text-sm">
														<thead>
															<tr class="bg-muted/50 border-b">
																<th class="p-3 text-left font-medium">Enrollment Year</th>
																<th class="p-3 text-center font-medium">Users</th>
																<th class="p-3 text-center font-medium">Percentage</th>
																<th class="p-3 text-center font-medium">Distribution</th>
															</tr>
														</thead>
														<tbody>
															{#each userInsights.usersByEnrollmentYear as year, index}
																<tr class="hover:bg-muted/25 border-b">
																	<td class="p-3 font-medium"
																		>{year.enrollmentYear || 'Not specified'}</td
																	>
																	<td class="p-3 text-center">{year.userCount}</td>
																	<td class="p-3 text-center">
																		<Badge variant="outline">{year.percentage.toFixed(1)}%</Badge>
																	</td>
																	<td class="p-3">
																		<div class="h-2 w-full rounded-full bg-gray-200">
																			<div
																				class="h-2 rounded-full bg-purple-600"
																				style="width: {Math.max(year.percentage, 2)}%"
																			></div>
																		</div>
																	</td>
																</tr>
															{/each}
														</tbody>
													</table>
												</div>
											</div>
										</div>
									{:else}
										<div class="space-y-4">
											<h4 class="text-lg font-semibold">Enrollment Year Distribution</h4>
											<div class="bg-muted/25 rounded-lg p-4 text-center">
												<p class="text-muted-foreground text-sm">
													No enrollment year data available
												</p>
											</div>
										</div>
									{/if}
								</div>

								<!-- Engagement Insights -->
								<!-- <div class="bg-muted/25 rounded-lg p-6">
									<h4 class="mb-4 text-lg font-semibold">Key Insights</h4>
									<div class="grid gap-4 md:grid-cols-2">
										<div class="space-y-2">
											<h5 class="font-medium">Engagement Quality</h5>
											<p class="text-muted-foreground text-sm">
												{#if userInsights.userEngagementRate >= 75}
													<span class="text-green-600">Excellent:</span> High user engagement indicates
													strong community participation and event relevance.
												{:else if userInsights.userEngagementRate >= 50}
													<span class="text-blue-600">Good:</span> Solid engagement levels with room
													for targeted improvement campaigns.
												{:else if userInsights.userEngagementRate >= 25}
													<span class="text-yellow-600">Fair:</span> Moderate engagement suggests need
													for better event promotion or content.
												{:else if userInsights.totalActiveUsers > 0}
													<span class="text-red-600">Needs Improvement:</span> Low engagement requires
													significant outreach and event strategy review.
												{:else}
													<span class="text-gray-600">No Data:</span> No user engagement data available
													for analysis. Consider checking your date filters or ensuring events exist
													in the system.
												{/if}
											</p>
										</div>
										<div class="space-y-2">
											<h5 class="font-medium">Growth Potential</h5>
											<p class="text-muted-foreground text-sm">
												{#if userInsights.averageEventsPerUser >= 3}
													Users are highly engaged with multiple event participations. Focus on
													retention strategies.
												{:else if userInsights.averageEventsPerUser >= 1.5}
													Good participation rate. Consider diversifying event types to increase
													engagement.
												{:else if userInsights.averageEventsPerUser > 0}
													Users typically attend few events. Implement strategies to encourage
													repeat participation.
												{:else}
													No event participation data available. This may indicate a new system or
													events not yet created for the selected period.
												{/if}
											</p>
										</div>
									</div>
								</div> -->
							</div>
						{/if}
					</CardContent>
				</Card>
			</Tabs.Content>

			<Tabs.Content value="reports">
				<Card>
					<CardHeader>
						<CardTitle>Comprehensive PDF Reports</CardTitle>
						<CardDescription>
							Generate detailed PDF reports with extensive analysis across all data tables, events, and
							user demographics.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div class="space-y-6">
							<!-- Report Overview -->
							<div class="bg-muted/25 rounded-lg p-6">
								<div class="mb-4 flex items-start gap-3">
									<div class="bg-primary/10 rounded-full p-2">
										<FileText class="text-primary h-6 w-6" />
									</div>
									<div class="flex-1">
										<h4 class="mb-2 text-lg font-semibold">What's Included in the Report?</h4>
										<p class="text-muted-foreground mb-4 text-sm">
											Generate a comprehensive PDF report that includes all analytics data with
											detailed breakdowns and insights.
										</p>
									</div>
								</div>

								<div class="grid gap-4 md:grid-cols-2">
									<div class="space-y-3">
										<h5 class="font-medium">Executive Summary</h5>
										<ul class="text-muted-foreground space-y-2 text-sm">
											<li class="flex items-start gap-2">
												<span class="text-primary mt-1">•</span>
												<span>Key performance indicators (KPIs) in table format</span>
											</li>
											<li class="flex items-start gap-2">
												<span class="text-primary mt-1">•</span>
												<span>Overall system metrics and statistics</span>
											</li>
											<li class="flex items-start gap-2">
												<span class="text-primary mt-1">•</span>
												<span>Comprehensive data overview</span>
											</li>
										</ul>
									</div>

									<div class="space-y-3">
										<h5 class="font-medium">Event Analysis</h5>
										<ul class="text-muted-foreground space-y-2 text-sm">
											<li class="flex items-start gap-2">
												<span class="text-primary mt-1">•</span>
												<span>Complete event performance data tables</span>
											</li>
											<li class="flex items-start gap-2">
												<span class="text-primary mt-1">•</span>
												<span>Attendance and registration statistics</span>
											</li>
											<li class="flex items-start gap-2">
												<span class="text-primary mt-1">•</span>
												<span>Event statistics summary table</span>
											</li>
										</ul>
									</div>

									<div class="space-y-3">
										<h5 class="font-medium">Organisation Data</h5>
										<ul class="text-muted-foreground space-y-2 text-sm">
											<li class="flex items-start gap-2">
												<span class="text-primary mt-1">•</span>
												<span>Complete organisation performance tables</span>
											</li>
											<li class="flex items-start gap-2">
												<span class="text-primary mt-1">•</span>
												<span>Event hosting and member statistics</span>
											</li>
											<li class="flex items-start gap-2">
												<span class="text-primary mt-1">•</span>
												<span>Organisation performance summary</span>
											</li>
										</ul>
									</div>

									<div class="space-y-3">
										<h5 class="font-medium">User Demographics</h5>
										<ul class="text-muted-foreground space-y-2 text-sm">
											<li class="flex items-start gap-2">
												<span class="text-primary mt-1">•</span>
												<span>Study program distribution tables</span>
											</li>
											<li class="flex items-start gap-2">
												<span class="text-primary mt-1">•</span>
												<span>Enrollment year and role breakdowns</span>
											</li>
											<li class="flex items-start gap-2">
												<span class="text-primary mt-1">•</span>
												<span>User engagement data and trends</span>
											</li>
										</ul>
									</div>
								</div>
							</div>

							<!-- Report Configuration -->
							<div class="space-y-4">
								<h4 class="text-lg font-semibold">Report Configuration</h4>
								<div class="bg-muted/25 rounded-lg p-4">
									<div class="grid gap-4 md:grid-cols-2">
										<div>
											<Label class="text-sm font-medium">Date Range</Label>
											<p class="text-muted-foreground mt-1 text-sm">
												{startDate && endDate
													? `${formatDateDisplay(startDate)} - ${formatDateDisplay(endDate)}`
													: 'All available data'}
											</p>
										</div>
										<div>
											<Label class="text-sm font-medium">Organisation Filter</Label>
											<p class="text-muted-foreground mt-1 text-sm">
												{selectedOrganisation
													? organisations.find((o) => o.organisation_id === selectedOrganisation)
															?.name || 'Unknown'
													: 'All organisations'}
											</p>
										</div>
									</div>
								</div>
							</div>

							<!-- Data Preview -->
							{#if overview}
								<div class="space-y-4">
									<h4 class="text-lg font-semibold">Data Preview</h4>
									<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
										<div class="bg-muted/25 rounded-lg p-4">
											<p class="text-muted-foreground text-sm">Events</p>
											<p class="text-2xl font-bold">{formatNumber(overview.totalEvents)}</p>
										</div>
										<div class="bg-muted/25 rounded-lg p-4">
											<p class="text-muted-foreground text-sm">Registrations</p>
											<p class="text-2xl font-bold">{formatNumber(overview.totalRegistrations)}</p>
										</div>
										<div class="bg-muted/25 rounded-lg p-4">
											<p class="text-muted-foreground text-sm">Organisations</p>
											<p class="text-2xl font-bold">{formatNumber(overview.totalOrganisations)}</p>
										</div>
										<div class="bg-muted/25 rounded-lg p-4">
											<p class="text-muted-foreground text-sm">Active Users</p>
											<p class="text-2xl font-bold">
												{userInsights ? formatNumber(userInsights.totalActiveUsers) : 'N/A'}
											</p>
										</div>
									</div>
								</div>

								<!-- Report Sections Included -->
								<div class="space-y-4">
									<h4 class="text-lg font-semibold">Report Sections</h4>
									<div class="grid gap-3 md:grid-cols-2">
										<div class="flex items-center gap-3 rounded-lg border p-3">
											<div class="bg-blue-100 text-blue-600 rounded p-2">
												<BarChart3 class="h-4 w-4" />
											</div>
											<div>
												<p class="font-medium">Executive Summary</p>
												<p class="text-muted-foreground text-xs">Key metrics overview</p>
											</div>
										</div>
										<div class="flex items-center gap-3 rounded-lg border p-3">
											<div class="bg-green-100 text-green-600 rounded p-2">
												<Activity class="h-4 w-4" />
											</div>
											<div>
												<p class="font-medium">Event Analytics</p>
												<p class="text-muted-foreground text-xs">
													{eventAnalytics.length} events analyzed
												</p>
											</div>
										</div>
										<div class="flex items-center gap-3 rounded-lg border p-3">
											<div class="bg-purple-100 text-purple-600 rounded p-2">
												<TrendingUp class="h-4 w-4" />
											</div>
											<div>
												<p class="font-medium">Monthly Trends</p>
												<p class="text-muted-foreground text-xs">
													{monthlyStats.length} months of data
												</p>
											</div>
										</div>
										<div class="flex items-center gap-3 rounded-lg border p-3">
											<div class="bg-red-100 text-red-600 rounded p-2">
												<Building class="h-4 w-4" />
											</div>
											<div>
												<p class="font-medium">Organisation Stats</p>
												<p class="text-muted-foreground text-xs">
													{organisationStats.length} organisations
												</p>
											</div>
										</div>
										<div class="flex items-center gap-3 rounded-lg border p-3">
											<div class="bg-yellow-100 text-yellow-600 rounded p-2">
												<Users class="h-4 w-4" />
											</div>
											<div>
												<p class="font-medium">User Insights</p>
												<p class="text-muted-foreground text-xs">Demographics & engagement</p>
											</div>
										</div>
										<div class="flex items-center gap-3 rounded-lg border p-3">
											<div class="bg-indigo-100 text-indigo-600 rounded p-2">
												<Target class="h-4 w-4" />
											</div>
											<div>
												<p class="font-medium">Overall Summary</p>
												<p class="text-muted-foreground text-xs">Complete statistics table</p>
											</div>
										</div>
									</div>
								</div>
							{/if}

							<!-- Generate Button -->
							<div class="flex flex-col items-center gap-4 pt-4">
								{#if !overview}
									<div class="bg-yellow-50 border-yellow-200 text-yellow-800 rounded-lg border p-4">
										<p class="text-sm">
											<strong>Note:</strong> Please run a search first to load analytics data before
											generating the report.
										</p>
									</div>
								{/if}
								<Button
									size="lg"
									onclick={generateComprehensivePDFReport}
									disabled={pdfLoading || !overview}
									class="w-full md:w-auto"
								>
									{#if pdfLoading}
										<div
											class="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"
										></div>
										Generating PDF Report...
									{:else}
										<FileText class="mr-2 h-4 w-4" />
										Generate Comprehensive PDF Report
									{/if}
								</Button>
								<p class="text-muted-foreground text-center text-sm">
									The report will be downloaded automatically when ready.
								</p>
							</div>

							<!-- Additional Notes -->
							<div class="bg-blue-50 border-blue-200 text-blue-800 rounded-lg border p-4">
								<h5 class="mb-2 font-medium">Report Features</h5>
								<ul class="space-y-1 text-sm">
									<li>• Professional styled title page with report metadata</li>
									<li>• All data presented in well-formatted tables</li>
									<li>• Multi-page layout with proper pagination</li>
									<li>• Comprehensive statistics and analytics</li>
									<li>• Pure data-driven content with no subjective analysis</li>
								</ul>
							</div>
						</div>
					</CardContent>
				</Card>
			</Tabs.Content>
		</Tabs.Root>
	{/if}
</div>
