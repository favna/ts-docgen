import { DeclarationReflection, DocMeta, parseMeta } from '../documentation';
import type { ClassMethodParamDoc } from './class';
import { DocType, parseType, typeUtil } from './types';

export interface TypedefDoc {
	name: string;
	description?: string | undefined;
	see?: string[] | undefined;
	access?: 'private' | undefined;
	deprecated?: boolean | undefined;
	type?: DocType | undefined;
	props?: ClassMethodParamDoc[] | undefined;
	params?: ClassMethodParamDoc[] | undefined;
	returns?: DocType | undefined;
	returnsDescription?: string | undefined;
	meta?: DocMeta | undefined;
}

export function parseTypedef(element: DeclarationReflection): TypedefDoc {
	const baseReturn: TypedefDoc = {
		name: element.name,
		description: element.comment?.shortText,
		see: element.comment?.tags?.filter((t) => t.tag === 'see').map((t) => t.text),
		access: element.flags.isPrivate || element.comment?.tags?.some((t) => t.tag === 'private') ? 'private' : undefined,
		deprecated: element.comment?.tags?.some((t) => t.tag === 'deprecated') ?? undefined,
		// @ts-ignore
		type: element.type ? parseType(element.type) : undefined,
		meta: parseMeta(element),
	};

	let typeDef: DeclarationReflection | undefined;
	if (typeUtil.isReflectionType(element.type)) {
		typeDef = element.type.declaration;
	} else if (element.kindString === 'Interface') {
		typeDef = element;
	} else if (element.kindString === 'Enumeration') {
		return {
			...baseReturn,
			props: element.children?.length
				? element.children.map((child) => ({
						name: child.name,
						description: child.comment?.shortText,
						type: typeof child.defaultValue === 'undefined' ? undefined : [[[child.defaultValue]]],
				  }))
				: undefined,
		};
	}

	if (typeDef) {
		const { children, signatures } = typeDef;

		// It's an instance-like typedef
		if (children && children.length > 0) {
			const props: ClassMethodParamDoc[] = children.map((child) => ({
				name: child.name,
				description: child.comment?.shortText ?? (child.signatures ?? [])[0]?.comment?.shortText,
				optional: child.flags.isOptional ?? (typeof child.defaultValue != 'undefined' || undefined),
				default: child.defaultValue ?? child.comment?.tags?.find((t) => t.tag === 'default')?.text ?? undefined,
				type: child.type
					? // @ts-ignore
					  parseType(child.type)
					: child.kindString === 'Method'
					? parseType({
							type: 'reflection',
							declaration: child,
					  })
					: undefined,
			}));

			return {
				...baseReturn,
				props,
			};
		}

		// For some reason, it's a function typedef
		if (signatures && signatures.length > 0) {
			const sig = signatures[0];

			const params: ClassMethodParamDoc[] | undefined = sig.parameters?.map((param) => ({
				name: param.name,
				description: param.comment?.shortText,
				optional: param.flags.isOptional ?? (typeof param.defaultValue != 'undefined' || undefined),
				default: param.defaultValue ?? param.comment?.tags?.find((t) => t.tag === 'default')?.text ?? undefined,
				// @ts-ignore
				type: param.type ? parseType(param.type) : undefined,
			}));

			return {
				...baseReturn,
				description: sig.comment?.shortText,
				see: sig.comment?.tags?.filter((t) => t.tag === 'see').map((t) => t.text),
				deprecated: sig.comment?.tags?.some((t) => t.tag === 'deprecated') ?? undefined,

				params,
				returns: sig.type ? parseType(sig.type) : undefined,
				returnsDescription: sig.comment?.returns,
			};
		}
	}

	// It's neither an interface-like or a function type
	return baseReturn;
}
