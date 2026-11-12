import {handler} from '../server/app.js';
export const GET=request=>handler(request,process.env);
export const POST=request=>handler(request,process.env);
export const PUT=request=>handler(request,process.env);
export const DELETE=request=>handler(request,process.env);
