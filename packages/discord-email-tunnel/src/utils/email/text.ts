import { convert as convertHtmlToText } from 'html-to-text';

export function getEmailText({
	cleanEmailHtml,
}: {
	cleanEmailHtml: string | undefined;
}) {
	let emailText: string;
	if (cleanEmailHtml === undefined) {
		emailText = '';
	} else {
		emailText = convertHtmlToText(cleanEmailHtml, {
			selectors: [
				{
					selector: 'blockquote',
					options: {
						leadingLineBreaks: 1,
						trailingLineBreaks: 1,
					},
				},
			],
		});
	}

	return emailText;
}
