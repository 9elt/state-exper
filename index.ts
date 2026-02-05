type CaptureRef = WeakRef<object>;

type ChangeHandler<T, C extends object[]> = (captures: C, context: ChangeContext, next: T, current: T) => void;

type AsHandler<T, C extends object[]> = (captures: C, context: ChangeContext, value: T) => unknown;

type Subscriber<T> = {
    handler: ChangeHandler<T, any>;
    refs: CaptureRef[];
    state: State<T>;
    context: ChangeContext;
};

type ChangeContext = Subscriber<any>[];

class State<T> {
    static cleanups: WeakMap<WeakKey, Function[]> = new WeakMap;
    static registry: FinalizationRegistry<Function[]> = new FinalizationRegistry(
        (cleanups) => cleanups.forEach((cleanup) => cleanup())
    );

    _val: T;
    _subs: Subscriber<T>[];

    constructor(value: T) {
        this._val = value;
        this._subs = [];
    }

    get value(): T {
        return this._val;
    }

    set value(value: T) {
        for (const sub of this._subs) {
            const captures = new Array<object>(sub.refs.length);

            let dropped = false;
            for (let i = 0; i < captures.length; i++) {
                const capture: object | undefined = sub.refs[i].deref();

                if (capture === undefined) {
                    dropped = true;
                    break;
                }

                captures[i] = capture;
            }

            if (dropped) {
                this.unSubscribe(sub);
                continue;
            }

            try {
                State.clearChangeContext(sub.context);
                sub.handler(captures, sub.context, value, this._val);
            } catch {
                //
            }
        }

        this._val = value;
    }

    onChangeWeak<const C extends object[]>(
        handler: ChangeHandler<T, C>,
        captures: C,
        context: ChangeContext
    ): Subscriber<T> {
        const refs = new Array<CaptureRef>(captures.length);

        for (let i = 0; i < captures.length; i++) {
            const capture = captures[i];

            refs[i] = new WeakRef(capture);

            const cleanups = State.cleanups.get(capture) ?? [];
            cleanups.push(() => this.unSubscribe(sub));

            State.cleanups.set(capture, cleanups);
            State.registry.register(capture, cleanups);
        }

        const sub: Subscriber<T> = {
            refs,
            handler,
            state: this,
            context: [],
        };

        context.push(sub);

        this._subs.push(sub);

        return sub;
    }

    asWeak<const C extends object[], H extends AsHandler<T, C>>(
        handler: H,
        captures: C,
        context: ChangeContext
    ): State<ReturnType<H>> {
        const state: State<any> = new State(undefined);

        const sub = this.onChangeWeak((captures, context, value) => {
            state.value = handler(captures, context, value);
        }, captures, context);

        sub.handler(captures, sub.context, this._val, this._val);

        return state;
    }

    unSubscribe(sub: Subscriber<T>): void {
        State.remove(this._subs, sub);
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

    div.style.color = color.value;

    color.onChangeWeak(([div], context, value) => {
        div.style.color = value;
        Nested(context);
        AsyncNested(context);
    }, [div], context);

    return (
        div
    );
}

function Nested(context: ChangeContext) {
    // how do we track this?
    background.onChangeWeak(([], _context, _next, _prev) => { }, [], context);

    const BACKGROUND = background.asWeak(([], _context, background) => {
        return background.toUpperCase();
    }, [], context);

    return (
        0
    );
}

async function AsyncNested(context: ChangeContext) {
    await Promise.resolve();

    // how the hell do we track this?
    background.onChangeWeak(([], _context, _next, _prev) => { }, [], context);

    return (
        0
    );
}
