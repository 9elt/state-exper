type CaptureRef = WeakRef<object>;

type ChangeHandler<T, C extends object[]> = (
    captures: C,
    context: ChangeContext,
    next: T,
    current: T,
) => void;

type AsHandler<T, C extends object[]> = (
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

class State<T> {
    static cleanups: WeakMap<WeakKey, Function[]> = new WeakMap;
    static registry: FinalizationRegistry<Function[]> = new FinalizationRegistry(
        (cleanups: Function[]): void => {
            for (const cleanup of cleanups) {
                cleanup();
            }
        }
    );

    _val: T;
    _handles: ChangeHandle<T>[];

    constructor(value: T) {
        this._val = value;
        this._handles = [];
    }

    get value(): T {
        return this._val;
    }

    set value(value: T) {
        for (const handle of this._handles) {
            handle(value, this._val);
        }
        this._val = value;
    }

    onChangeWeak<const C extends object[]>(
        handler: ChangeHandler<T, C>,
        captures: C,
        context: ChangeContext
    ): ChangeHandle<T> {
        const refs = new Array<CaptureRef>(captures.length);

        for (let i = 0; i < captures.length; i++) {
            const capture = captures[i];

            refs[i] = new WeakRef(capture);

            const cleanups = State.cleanups.get(capture) ?? [];
            cleanups.push(() => this._removeHandle(handle));

            State.cleanups.set(capture, cleanups);
            State.registry.register(capture, cleanups);
        }

        function handle(
            next: T = handle.state.value,
            current: T = handle.state.value,
        ): void {
            if (handle.removed) {
                console.error("Change handle already removed", handle);
                return undefined;
            }

            const captures = new Array<object>(refs.length);

            for (let i = 0; i < captures.length; i++) {
                const capture = refs[i].deref();

                if (capture === undefined) {
                    handle.state._removeHandle(handle);
                    return undefined;
                }

                captures[i] = capture;
            }

            try {
                State._clearChangeContext(handle.context);
                handler(captures as C, handle.context, next, current);
            } catch (error) {
                console.error("Error in change handle", handle, error);
            }
        }

        handle.state = this;
        handle.context = [] as ChangeContext;
        handle.removed = false;

        context.push(handle);

        this._handles.push(handle);

        return handle;
    }

    asWeak<const C extends object[], H extends AsHandler<T, C>>(
        handler: H,
        captures: C,
        context: ChangeContext
    ): State<ReturnType<H>> {
        const state: State<any> = new State(undefined);

        this.onChangeWeak(([state, ...captures], context, value) => {
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

        State._clearChangeContext(handle.context);
    }

    static _clearChangeContext(context: ChangeContext): void {
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

    color.onChangeWeak(([div], context, value) => {
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
    background.onChangeWeak(() => { }, [], context);

    const _BACKGROUND = background.asWeak(([], _context, value) => {
        return value.toUpperCase();
    }, [], context);

    return (
        0
    );
}

async function AsyncNested(context: ChangeContext) {
    await Promise.resolve();

    // how the hell do we track this?
    background.onChangeWeak(() => { }, [], context);

    return (
        0
    );
}
