type Capture = object;

type ChangeHandler<C extends Capture[], T> = (
    captures: C,
    context: ChangeContext,
    next: T,
    current: T,
) => void;

type DeriveHandler<C extends Capture[], T> = (
    captures: C,
    context: ChangeContext,
    value: T,
) => unknown;

type ChangeHandle<T> = ((next?: T, current?: T) => void) & {
    state: State<T>;
    context: ChangeContext;
    removed: boolean;
};

type ChangeContext = ChangeHandle<any>[];

type CleanupContext = ChangeHandle<any>[];

class State<T> {
    static cleanups = new WeakMap<Capture, CleanupContext>;
    static registry = new FinalizationRegistry<CleanupContext>(State._clearContext);

    _value: T;
    _handles: ChangeHandle<T>[];

    constructor(value: T) {
        this._value = value;
        this._handles = [];
    }

    get value(): T {
        return this._value;
    }

    set value(value: T) {
        for (const handle of this._handles) {
            handle(value, this._value);
        }
        this._value = value;
    }

    onChange<const C extends Capture[]>(
        handler: ChangeHandler<C, T>,
        captures: C,
        context: ChangeContext,
    ): ChangeHandle<T> {
        const refs = new Array<WeakRef<Capture>>(captures.length);

        for (let i = 0; i < captures.length; i++) {
            const capture = captures[i];

            refs[i] = new WeakRef(capture);

            const cleanupContext = State.cleanups.get(capture) ?? [];
            cleanupContext.push(handle);
            State.cleanups.set(capture, cleanupContext);
            State.registry.register(capture, cleanupContext);
        }

        function handle(
            next: T = handle.state.value,
            current: T = handle.state.value,
        ): void {
            if (handle.removed) {
                return undefined;
            }

            const captures = new Array<Capture>(refs.length);

            for (let i = 0; i < refs.length; i++) {
                const capture = refs[i].deref();

                if (capture === undefined) {
                    handle.state._removeHandle(handle);
                    return undefined;
                }

                captures[i] = capture;
            }

            State._clearContext(handle.context);

            handler(captures as C, handle.context, next, current);
        }

        handle.state = this;
        handle.context = [] as ChangeContext;
        handle.removed = false;

        context.push(handle);
        this._handles.push(handle);

        return handle;
    }

    derive<const C extends Capture[], H extends DeriveHandler<C, T>>(
        handler: H,
        captures: C,
        context: ChangeContext,
    ): State<ReturnType<H>> {
        const state: State<any> = new State(undefined);

        this.onChange(([state, ...captures], context, value) => {
            state.value = handler(captures, context, value);
        }, [state, ...captures], context)();

        return state;
    }

    _removeHandle(handle: ChangeHandle<T>): void {
        if (handle.removed) {
            return undefined;
        }

        handle.removed = true;

        for (let i = 0; i < this._handles.length; i++) {
            if (this._handles[i] === handle) {
                this._handles.splice(i, 1);
                break;
            }
        }

        State._clearContext(handle.context);
    }

    static _clearContext(context: ChangeContext | CleanupContext): void {
        for (const handle of context) {
            handle.state._removeHandle(handle);
        }
    }
}

/*








*/

const color = new State("red");

const background = new State("blue");

function Example(context: ChangeContext) {
    const div = document.createElement("div");

    color.onChange(([div], context, value) => {
        div.style.color = value;
        Nested(context);
        AsyncNested(context);
    }, [div], context)();

    return (
        div
    );
}

function Nested(context: ChangeContext) {
    // how do we track this?
    background.onChange(() => { }, [], context);

    const _BACKGROUND = background.derive(([], _context, value) => {
        return value.toUpperCase();
    }, [], context);

    return (
        0
    );
}

async function AsyncNested(context: ChangeContext) {
    await Promise.resolve();

    // how the hell do we track this?
    background.onChange(() => { }, [], context);

    return (
        0
    );
}
