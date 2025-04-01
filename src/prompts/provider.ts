import vscode from 'vscode';
import { info, warn } from '../modules/log';
import { autocomplete } from './autocomplete';
import { preparePrompt } from './preparePrompt';
import { AsyncLock } from '../modules/lock';
import { isNotNeeded, isSupported } from './filter';
import { config } from '../config';

type Status = {
    icon: string;
    text: string;
};

export class PromptProvider implements vscode.InlineCompletionItemProvider {

    lock = new AsyncLock();
    statusbar: vscode.StatusBarItem;
    context: vscode.ExtensionContext;
    private _paused: boolean = false;
    private _status: Status = { icon: "chip", text: "Llama Coder" };

    constructor(statusbar: vscode.StatusBarItem, context: vscode.ExtensionContext) {
        this.statusbar = statusbar;
        this.context = context;
    }
    
    public set paused(value: boolean) {
        this._paused = value;
        this.update();
    }

    public get paused(): boolean {
        return this._paused;
    }

    private update(icon?: string, text?: string): void {
        this._status.icon = icon ? icon : this._status.icon;
        this._status.text = text ? text : this._status.text;

        let statusText = '';
        let statusTooltip = '';
        if (this._paused) {
            statusText = `$(sync-ignored) ${this._status.text}`;
            statusTooltip = `${this._status.text} (Paused)`;
        } else {
            statusText = `$(${this._status.icon}) ${this._status.text}`;
            statusTooltip = `${this._status.text}`;
        }
        this.statusbar.text = statusText;
        this.statusbar.tooltip = statusTooltip;
    }

    async delayCompletion(delay: number, token: vscode.CancellationToken): Promise<boolean> {
        if (config.inference.delay < 0) {
            return false;
        }
        await new Promise(p => setTimeout(p, delay));
        if (token.isCancellationRequested) {
            return false;
        }
        return true;
    }

    async provideInlineCompletionItems(document: vscode.TextDocument, position: vscode.Position, context: vscode.InlineCompletionContext, token: vscode.CancellationToken): Promise<vscode.InlineCompletionItem[] | vscode.InlineCompletionList | undefined | null> {
        if (!await this.delayCompletion(config.inference.delay, token)) {
            return;
        }

        try {
            if (this.paused) {
                return;
            }

            // Ignore unsupported documents
            if (!isSupported(document)) {
                info(`Unsupported document: ${document.uri.toString()} ignored.`);
                return;
            }

            // Ignore if not needed
            if (isNotNeeded(document, position, context)) {
                info('No inline completion required');
                return;
            }

            // Ignore if already canceled
            if (token.isCancellationRequested) {
                info(`Canceled before AI completion.`);
                return;
            }

            // Execute in lock
            return await this.lock.inLock(async () => {

                // Prepare context
                let prepared = await preparePrompt(document, position, context);
                if (token.isCancellationRequested) {
                    info(`Canceled before AI completion.`);
                    return;
                }

                // Result
                let res: string | null = null;

                // Config
                let inferenceConfig = config.inference;

                // Update status
                this.update('sync~spin', 'Llama Coder');
                try {
                    if (token.isCancellationRequested) {
                        info(`Canceled after AI completion.`);
                        return;
                    }

                    // Run AI completion
                    info(`Running AI completion...`);
                    res = await autocomplete({
                        prefix: prepared.prefix,
                        suffix: prepared.suffix,
                        endpoint: inferenceConfig.endpoint,
                        bearerToken: inferenceConfig.bearerToken,
                        model: inferenceConfig.modelName,
                        maxLines: inferenceConfig.maxLines,
                        maxTokens: inferenceConfig.maxTokens,
                        temperature: inferenceConfig.temperature,
                        canceled: () => token.isCancellationRequested,
                    });
                    info(`AI completion completed: ${res}`);
                } finally {
                    this.update('chip', 'Llama Coder');
                }
                if (token.isCancellationRequested) {
                    info(`Canceled after AI completion.`);
                    return;
                }

                // Return result
                if (res && res.trim() !== '') {
                    return [{
                        insertText: res,
                        range: new vscode.Range(position, position),
                    }];
                }

                // Nothing to complete
                return;
            });
        } catch (e) {
            warn('Error during inference:', e);
        }
    }
}