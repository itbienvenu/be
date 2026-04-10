declare module "*.txt" {
    const content: string;
    export default content;
}


export type ApiErrorResponse = {
    success: boolean;
    message: string;
    data?: null;
}