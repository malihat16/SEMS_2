import { Resend } from 'resend';
import Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join } from 'path';
import { env } from '$env/dynamic/private';

// Default sender email
const DEFAULT_FROM_EMAIL = 'SEMS <noreply@sems2.app>';

let resendClient: Resend | null = null;

function getResendClient(): Resend {
	if (resendClient) {
		return resendClient;
	}

	const resendApiKey = env.RESEND_API_KEY;
	if (!resendApiKey) {
		throw new Error('RESEND_API_KEY is missing at runtime');
	}

	resendClient = new Resend(resendApiKey);

	return resendClient;
}

/**
 * Email sending options
 */
export interface EmailOptions {
	to: string;
	subject: string;
	html: string;
	attachments?: Array<{
		filename: string;
		content: Buffer;
		contentId?: string; // For inline images using CID (camelCase for Resend SDK)
	}>;
}

/**
 * Send an email using Resend
 * @param options - Email options (to, subject, html, attachments)
 * @returns Promise with Resend response
 */
export async function sendEmail(options: EmailOptions): Promise<{
	success: boolean;
	messageId?: string;
	error?: string;
}> {
	try {
		const response = await getResendClient().emails.send({
			from: DEFAULT_FROM_EMAIL,
			to: options.to,
			subject: options.subject,
			html: options.html,
			attachments: options.attachments
		});

		if (response.error) {
			console.error('Resend API error:', response.error);
			return {
				success: false,
				error: response.error.message || 'Failed to send email'
			};
		}

		return {
			success: true,
			messageId: response.data?.id
		};
	} catch (error) {
		console.error('Error sending email:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error occurred'
		};
	}
}

/**
 * Load and compile a Handlebars template
 * @param templateName - Name of the template file (without .hbs extension)
 * @returns Compiled Handlebars template function
 */
function loadTemplate(templateName: string): HandlebarsTemplateDelegate {
	// In SvelteKit, we need to use process.cwd() to get the project root
	const templatePath = join(
		process.cwd(),
		'src',
		'lib',
		'email',
		'templates',
		`${templateName}.hbs`
	);

	try {
		const templateContent = readFileSync(templatePath, 'utf-8');
		return Handlebars.compile(templateContent);
	} catch (error) {
		console.error(`Error loading template ${templateName}:`, error);
		throw new Error(`Failed to load email template: ${templateName}`);
	}
}

/**
 * Render a Handlebars template with data
 * @param templateName - Name of the template file (without .hbs extension)
 * @param data - Template data
 * @returns Rendered HTML string
 */
export function renderTemplate<T extends Record<string, unknown>>(
	templateName: string,
	data: T
): string {
	const template = loadTemplate(templateName);
	return template(data);
}

/**
 * Send a templated email
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param templateName - Template name
 * @param templateData - Data to pass to the template
 * @param attachments - Optional email attachments
 * @returns Promise with send result
 */
export async function sendTemplatedEmail<T extends Record<string, unknown>>(
	to: string,
	subject: string,
	templateName: string,
	templateData: T,
	attachments?: Array<{ filename: string; content: Buffer; contentId?: string }>
): Promise<{
	success: boolean;
	messageId?: string;
	error?: string;
}> {
	try {
		// Render template
		const html = renderTemplate(templateName, templateData);

		// Send email
		return await sendEmail({
			to,
			subject,
			html,
			attachments
		});
	} catch (error) {
		console.error('Error sending templated email:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Failed to send templated email'
		};
	}
}

/**
 * Validate email address format
 * @param email - Email address to validate
 * @returns True if valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}

/**
 * Batch send emails with rate limiting
 * @param emails - Array of email options
 * @param delayMs - Delay between sends in milliseconds (default: 100ms)
 * @returns Promise with array of results
 */
export async function batchSendEmails(
	emails: EmailOptions[],
	delayMs = 100
): Promise<
	Array<{
		success: boolean;
		messageId?: string;
		error?: string;
		email: string;
	}>
> {
	const results: Array<{
		success: boolean;
		messageId?: string;
		error?: string;
		email: string;
	}> = [];

	for (const emailOptions of emails) {
		const result = await sendEmail(emailOptions);
		results.push({
			...result,
			email: emailOptions.to
		});

		// Add delay to avoid rate limiting
		if (delayMs > 0 && emails.indexOf(emailOptions) < emails.length - 1) {
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
	}

	return results;
}

/**
 * Helper function to register Handlebars helpers
 * Call this once during app initialization
 */
export function registerHandlebarsHelpers() {
	// Format date helper
	Handlebars.registerHelper('formatDate', (dateString: string) => {
		if (!dateString) return 'TBA';
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			weekday: 'short',
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	});

	// Format time helper
	Handlebars.registerHelper('formatTime', (dateString: string) => {
		if (!dateString) return '';
		const date = new Date(dateString);
		return date.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: true
		});
	});

	// Format datetime helper
	Handlebars.registerHelper('formatDateTime', (dateString: string) => {
		if (!dateString) return 'TBA';
		const date = new Date(dateString);
		const dateStr = date.toLocaleDateString('en-US', {
			weekday: 'short',
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			timeZone: 'Asia/Kuala_Lumpur'
		});
		const timeStr = date.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: true,
			timeZone: 'Asia/Kuala_Lumpur'
		});
		return `${dateStr} at ${timeStr} (Malaysian Standard Time UTC+08:00)`;
	});
}

// Register helpers on module load
registerHandlebarsHelpers();
