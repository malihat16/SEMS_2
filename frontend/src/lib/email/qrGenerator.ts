import QRCode from 'qrcode';

/**
 * Generate a QR code as a data URL from the given registration ID
 * @param registrationId - The registration ID to encode in the QR code
 * @param options - Optional QR code generation options
 * @returns Promise resolving to a base64 data URL string, or null if generation fails
 */
export async function generateQrCodeDataUrl(
	registrationId: string,
	options?: {
		width?: number;
		margin?: number;
		darkColor?: string;
		lightColor?: string;
	}
): Promise<string | null> {
	try {
		const qrDataUrl = await QRCode.toDataURL(registrationId, {
			width: options?.width ?? 256,
			margin: options?.margin ?? 2,
			color: {
				dark: options?.darkColor ?? '#000000',
				light: options?.lightColor ?? '#FFFFFF'
			}
		});
		return qrDataUrl;
	} catch (error) {
		console.error('Error generating QR code:', error);
		return null;
	}
}

/**
 * Generate a QR code as a Buffer for server-side use (e.g., email attachments)
 * @param registrationId - The registration ID to encode in the QR code
 * @param options - Optional QR code generation options
 * @returns Promise resolving to a Buffer, or null if generation fails
 */
export async function generateQrCodeBuffer(
	registrationId: string,
	options?: {
		width?: number;
		margin?: number;
		darkColor?: string;
		lightColor?: string;
	}
): Promise<Buffer | null> {
	try {
		const qrBuffer = await QRCode.toBuffer(registrationId, {
			width: options?.width ?? 256,
			margin: options?.margin ?? 2,
			color: {
				dark: options?.darkColor ?? '#000000',
				light: options?.lightColor ?? '#FFFFFF'
			},
			type: 'png'
		});
		return qrBuffer;
	} catch (error) {
		console.error('Error generating QR code buffer:', error);
		return null;
	}
}
