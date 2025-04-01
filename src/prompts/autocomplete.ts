import { makeOllamaRequest } from "../modules/ollamaRequest";

type OllamaToken = {
    model: string,
    response: string,
};

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
        stream: false,
        options: {
            num_predict: args.maxTokens,
            temperature: args.temperature
        }
    };

    const res = await makeOllamaRequest(args.endpoint + '/api/generate', data, args.bearerToken);
    try {
        const tokens =  JSON.parse(res) as OllamaToken;
        if (args.canceled && args.canceled()) {
            return "";
        }
        const response = tokens.response;
        
        // take only args.maLines lines from the response
        let lines = response.split('\n');
        lines = lines.slice(0, args.maxLines);
        return lines.join('\n');
    } catch (e) { 
        console.warn('Receive wrong line: ' + res);
        return "";
    }
}