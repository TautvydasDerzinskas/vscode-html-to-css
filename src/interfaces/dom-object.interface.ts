export default interface IDomObject {
    tag: string;
    classes: string[];
    ids: string[];
    children: IDomObject[];
}
