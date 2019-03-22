export default interface IDomObject {
    tag: string;
    metaTag?: string;
    classes: string[];
    ids: string[];
    children: IDomObject[];
}
