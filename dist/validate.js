import Ajv2020 from 'ajv/dist/2020.js';
import fs from 'node:fs';
export function validateUnified(data, schemaPath) {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    const ok = validate(data);
    if (!ok) {
        const msg = (validate.errors ?? []).map(e => `${e.instancePath} ${e.message}`).join('\n');
        throw new Error('Unified JSON validation failed:\n' + msg);
    }
}
