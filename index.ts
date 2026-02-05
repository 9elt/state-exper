type CaptureRef = WeakRef<object>;

type ChangeHandler<T, C extends object[]> = (captures: C, context: ChangeContext, next: T, current: T) => void;

type AsHandler<T, C extends object[]> = (captures: C, context: ChangeContext, value: T) => unknown;

type ChangeHandle<T> = {
    handler: ChangeHandler<T, any>;
    refs: CaptureRef[];
    state: State<T>;
    context: ChangeContext;
    exec: (next?: T, current?: T) => void;
};

type ChangeContext = ChangeHandle<any>[];

class State<T> {
    static cleanups: WeakMap<WeakKey, Function[]> = new WeakMap;
    static registry: FinalizationRegistry<Function[]> = new FinalizationRegistry(
        (cleanups) => cleanups.forEach((cleanup) => cleanup())
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
        for (const sub of this._handles) {
            sub.exec(value, this._val);
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
            cleanups.push(() => this.unSubscribe(handle));

            State.cleanups.set(capture, cleanups);
            State.registry.register(capture, cleanups);
        }

        const handle: ChangeHandle<T> = {
            refs,
            handler,
            state: this,
            context: [],
            exec(next: T = handle.state.value, current: T = handle.state.value): void {
                const captures = new Array<object>(handle.refs.length);

                for (let i = 0; i < captures.length; i++) {
                    const capture = handle.refs[i].deref();

                    if (capture === undefined) {
                        handle.state.unSubscribe(handle);
                        return;
                    }

                    captures[i] = capture;
                }

                try {
                    State.clearChangeContext(handle.context);
                    handle.handler(captures, handle.context, next, current);
                } catch {
                    //
                }
            },
        };

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
        }, [state, ...captures], context).exec();

        return state;
    }

    unSubscribe(sub: ChangeHandle<T>): void {
        State.remove(this._handles, sub);
        State.clearChangeContext(sub.context);
    }

    static clearChangeContext(context: ChangeContext): void {
        for (const sub of context) {
            sub.state.unSubscribe(sub);
        }
    }

    static remove<T>(arr: T[], exclude: T): void {
        let length = 0;
        for (let i = 0; i < arr.length; i++) {
            const sub = arr[i];

            if (sub !== exclude) {
                if (i > length) {
                    arr[length] = sub;
                }
                length++;
            }
        }

        if (arr.length !== length) {
            arr.length = length;
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
    }, [div], context).exec();

    return (
        div
    );
}

function Nested(context: ChangeContext) {
    // how do we track this?
    background.onChangeWeak(([], _context, _next, _current) => { }, [], context);

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
    background.onChangeWeak(([], _context, _next, _current) => { }, [], context);

    return (
        0
    );
}
