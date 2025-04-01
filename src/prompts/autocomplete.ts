import { ollamaTokenGenerator } from '../modules/ollamaTokenGenerator';
import { countSymbol } from '../modules/text';
import { info } from '../modules/log';

export async function autocomplete(args: {
    endpoint: string,
    bearerToken: string,
    model: string,
    prefix: string,
    suffix: string,
    maxLines: number,
    maxTokens: number,
    temperature: number,
    canceled?: () => boolean,
}): Promise<string> {

    // Calculate arguments
    let data = {
        model: args.model,
        prompt: args.prefix,
        suffix: args.suffix,
        raw: true,
        options: {
            num_predict: args.maxTokens,
            temperature: args.temperature
        }
    };

    // Receiving tokens
    let res = '';
    let totalLines = 1;
    for await (let tokens of ollamaTokenGenerator(args.endpoint + '/api/generate', data, args.bearerToken)) {
        if (args.canceled && args.canceled()) {
            break;
        }

        res = res + tokens.response;

        // Update total lines
        totalLines += countSymbol(tokens.response, '\n');
        // Break if too many lines and on top level
        if (totalLines > args.maxLines) {
            info('Too many lines, breaking.');
            break;
        }
    }

    return res;
}