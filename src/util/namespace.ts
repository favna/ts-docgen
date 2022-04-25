import { DocMeta, parseMeta, type DeclarationReflection } from '../documentation';
import { parseTypedef, TypedefDoc } from './typedef';

export interface NamespaceDoc {
	deprecated?: boolean | undefined;
	description?: string | undefined;
	enumerations?: TypedefDoc[] | undefined;
	extendedDescription?: string | undefined;
	interfaces?: TypedefDoc[] | undefined;
	isExternal?: boolean | undefined;
	meta?: DocMeta | undefined;
	name: string;
	see?: string[] | undefined;
	typeAliases?: TypedefDoc[] | undefined;
}

export function parseNamespace(element: DeclarationReflection): NamespaceDoc {
	const typeAliases = element.children?.filter((c) => c.kindString === 'Type alias');
	const interfaces = element.children?.filter((c) => c.kindString === 'Interface');
	const enumerations = element.children?.filter((c) => c.kindString === 'Enumeration');

	return {
		name: element.name,
		description: element.comment?.shortText?.trim(),
		extendedDescription: element.comment?.text?.trim(),
		see: element.comment?.tags?.filter((t) => t.tag === 'see').map((t) => t.text.trim()),
		deprecated: element.comment?.tags?.some((t) => t.tag === 'deprecated'),
		typeAliases: typeAliases && typeAliases.length > 0 ? typeAliases.map(parseTypedef) : undefined,
		interfaces: interfaces && interfaces.length > 0 ? interfaces.map(parseTypedef) : undefined,
		enumerations: enumerations && enumerations.length > 0 ? enumerations.map(parseTypedef) : undefined,
		meta: parseMeta(element),
		isExternal: element.flags.isExternal,
	};
}
