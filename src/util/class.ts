import path from 'node:path';
import { DeclarationReflection, DocMeta, parseMeta } from '../documentation';
import { DocType, parseType, parseTypeSimple } from './types';

export interface ClassDoc {
	abstract?: boolean | undefined;
	access?: 'private' | undefined;
	construct?: ClassMethodDoc | undefined;
	deprecated?: boolean | undefined;
	description?: string | undefined;
	events?: ClassEventDoc[] | undefined;
	examples?: string[] | undefined;
	extendedDescription?: string | undefined;
	extends?: [string] | undefined;
	implements?: [string] | undefined;
	isExternal?: boolean | undefined;
	meta?: DocMeta | undefined;
	methods?: ClassMethodDoc[] | undefined;
	name: string;
	props?: ClassPropDoc[] | undefined;
	see?: string[] | undefined;
}

export function parseClass(element: DeclarationReflection): ClassDoc {
	const extended = element.extendedTypes?.[0];
	const implemented = element.implementedTypes?.[0];
	const examples = element.comment?.tags?.filter((t) => t.tag === 'example')?.map((t) => t.text.trim());

	const construct = element.children?.find((c) => c.kindString === 'Constructor');
	// Ignore setter-only accessors (the typings still exist, but the docs don't show them)
	const props = element.children?.filter(
		(c) => c.kindString === 'Property' || (c.kindString === 'Accessor' && c.getSignature?.length),
	);
	const methods = element.children?.filter((c) => c.kindString === 'Method');
	const events = element.children?.filter((c) => c.kindString === 'Event');

	const meta = parseMeta(element);

	return {
		name: element.name === 'default' ? path.parse(meta?.file ?? 'default').name : element.name,
		description: element.comment?.shortText?.trim(),
		extendedDescription: element.comment?.text?.trim(),
		see: element.comment?.tags?.filter((t) => t.tag === 'see').map((t) => t.text.trim()),
		extends: extended ? [parseTypeSimple(extended)] : undefined,
		implements: implemented ? [parseTypeSimple(implemented)] : undefined,
		examples: examples ? examples : undefined,
		access:
			element.flags.isPrivate || element.comment?.tags?.some((t) => t.tag === 'private' || t.tag === 'internal')
				? 'private'
				: undefined,
		abstract: element.comment?.tags?.some((t) => t.tag === 'abstract'),
		deprecated: element.comment?.tags?.some((t) => t.tag === 'deprecated'),
		construct: construct ? parseClassMethod(construct) : undefined,
		props: props && props.length > 0 ? props.map(parseClassProp) : undefined,
		methods: methods && methods.length > 0 ? methods.map(parseClassMethod) : undefined,
		events: events && events.length > 0 ? events.map(parseClassEvent) : undefined,
		meta,
		isExternal: element.flags.isExternal,
	};
}

interface ClassPropDoc {
	abstract?: boolean | undefined;
	access?: 'private' | undefined;
	default?: string | boolean | number | undefined;
	deprecated?: boolean | undefined;
	description?: string | undefined;
	extendedDescription?: string | undefined;
	meta?: DocMeta | undefined;
	name: string;
	nullable?: never | undefined; // it would already be in the type
	props?: never | undefined; // prefer using a type reference (like a dedicated instance) instead of documenting using @property tags
	readonly?: boolean | undefined;
	scope?: 'static' | undefined;
	see?: string[] | undefined;
	type?: DocType | undefined;
}

function parseClassProp(element: DeclarationReflection): ClassPropDoc {
	const base: ClassPropDoc = {
		name: element.name,
		description: element.comment?.shortText?.trim(),
		extendedDescription: element.comment?.text?.trim(),
		see: element.comment?.tags?.filter((t) => t.tag === 'see').map((t) => t.text.trim()),
		scope: element.flags.isStatic ? 'static' : undefined,
		access:
			element.flags.isPrivate || element.comment?.tags?.some((t) => t.tag === 'private' || t.tag === 'internal')
				? 'private'
				: undefined,
		readonly: element.flags.isReadonly,
		abstract: element.comment?.tags?.some((t) => t.tag === 'abstract'),
		deprecated: element.comment?.tags?.some((t) => t.tag === 'deprecated'),
		default:
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			element.comment?.tags?.find((t) => t.tag === 'default')?.text?.trim() ??
			(element.defaultValue === '...' ? undefined : element.defaultValue),
		// @ts-ignore
		type: element.type ? parseType(element.type) : undefined,
		meta: parseMeta(element),
	};

	if (element.kindString === 'Accessor') {
		// I'll just ignore set signatures: if there's a getter, I'll take the docs from that
		// If a set signature is not present at all, I'll mark the prop as readonly.

		const getter = element.getSignature?.[0];
		const hasSetter = Boolean(element.setSignature?.length);
		const res = { ...base };

		if (!getter) {
			// This should never happen, it should be avoided before this function is called.
			throw new Error("Can't parse accessor without getter.");
		}

		if (!hasSetter) res.readonly = true;

		return {
			...res,
			description: getter.comment?.shortText?.trim(),
			extendedDescription: getter.comment?.text?.trim(),
			see: getter.comment?.tags?.filter((t) => t.tag === 'see').map((t) => t.text.trim()),
			access:
				getter.flags.isPrivate || getter.comment?.tags?.some((t) => t.tag === 'private' || t.tag === 'internal')
					? 'private'
					: undefined,
			readonly: res.readonly ?? !hasSetter,
			abstract: getter.comment?.tags?.some((t) => t.tag === 'abstract'),
			deprecated: getter.comment?.tags?.some((t) => t.tag === 'deprecated'),
			default:
				res.default ??
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
				getter.comment?.tags?.find((t) => t.tag === 'default')?.text?.trim() ??
				// @ts-expect-error
				getter.defaultValue,
			type: getter.type ? parseType(getter.type) : undefined,
		};
	}

	return base;
}

interface ClassMethodDoc {
	abstract?: boolean | undefined;
	access?: 'private' | undefined;
	async?: never | undefined; // it would already be in the type
	deprecated?: boolean | undefined;
	description?: string | undefined;
	emits?: string[] | undefined;
	examples?: string[] | undefined;
	extendDescription?: string | undefined;
	generator?: never | undefined; // not used by djs
	implements?: never | undefined; // let's just don't
	inherited?: never | undefined; // let's just don't
	inherits?: never | undefined; // let's just don't
	meta?: DocMeta | undefined;
	name: string;
	params?:
		| {
				name: string;
				description?: string | undefined;
				optional?: boolean | undefined;
				default?: string | boolean | number | undefined;
				variable?: never | undefined; // it would already be in the type
				nullable?: never | undefined; // it would already be in the type
				type?: DocType | undefined;
		  }[]
		| undefined;
	returns?: DocType | undefined;
	returnsDescription?: string | undefined;
	scope?: 'static' | undefined;
	see?: string[] | undefined;
	throws?: never | undefined; // let's just don't
}

export function parseClassMethod(element: DeclarationReflection): ClassMethodDoc {
	const signature = (element.signatures ?? [])[0] || element;

	return {
		name: element.name,
		description: signature.comment?.shortText?.trim(),
		extendDescription: signature.comment?.text?.trim(),
		see: signature.comment?.tags?.filter((t) => t.tag === 'see').map((t) => t.text.trim()),
		scope: element.flags.isStatic ? 'static' : undefined,
		access:
			element.flags.isPrivate || signature.comment?.tags?.some((t) => t.tag === 'private' || t.tag === 'internal')
				? 'private'
				: undefined,
		examples: signature.comment?.tags?.filter((t) => t.tag === 'example').map((t) => t.text.trim()),
		abstract: signature.comment?.tags?.some((t) => t.tag === 'abstract'),
		deprecated: signature.comment?.tags?.some((t) => t.tag === 'deprecated'),
		emits: signature.comment?.tags?.filter((t) => t.tag === 'emits').map((t) => t.text.trim()),
		params: signature.parameters ? signature.parameters.map(parseParam) : undefined,
		returns: signature.type ? parseType(signature.type) : undefined,
		returnsDescription: signature.comment?.returns?.trim(),
		meta: parseMeta(element),
	};
}

export type ClassMethodParamDoc = Exclude<ClassMethodDoc['params'], undefined>[number];

export function parseParam(param: DeclarationReflection): ClassMethodParamDoc {
	return {
		name: param.name,
		description: param.comment?.shortText?.trim() ?? param.comment?.text?.trim(),
		optional: param.flags.isOptional ?? typeof param.defaultValue != 'undefined',
		default:
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			param.comment?.tags?.find((t) => t.tag === 'default')?.text?.trim() ??
			(param.defaultValue === '...' ? undefined : param.defaultValue),
		// @ts-ignore
		type: param.type ? parseType(param.type) : undefined,
	};
}

interface ClassEventDoc {
	deprecated?: boolean | undefined;
	description?: string | undefined;
	extendedDescription?: string | undefined;
	meta?: DocMeta | undefined;
	name: string;
	params?:
		| {
				name: string;
				description?: string | undefined;
				optional?: boolean | undefined;
				default?: string | boolean | number | undefined;
				variable?: never | undefined; // it would already be in the type
				nullable?: never | undefined; // it would already be in the type
				type?: DocType | undefined;
		  }[]
		| undefined;
	see?: string[] | undefined;
}

function parseClassEvent(element: DeclarationReflection): ClassEventDoc {
	return parseClassMethod(element);
}
