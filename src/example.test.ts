import {
    Collection,
    Entity,
    ManyToOne,
    MikroORM,
    OneToMany,
    PrimaryKey,
    PrimaryKeyProp,
    Property,
    ref,
    Ref,
    wrap
} from '@mikro-orm/sqlite';

@Entity()
class Book {
    @PrimaryKey()
    id!: number;

    @Property()
    title!: string;

    @OneToMany(() => Chapter, m => m.book)
    chapters = new Collection<Chapter>(this);

    @ManyToOne(() => Chapter, {
        ref: true,
        nullable: true,
        serializer: (m: Chapter) => m?.id,
        deleteRule: 'set null',
        default: null,
    })
    public currentChapter?: Ref<Chapter>;


    @Property({
        serializer: (p: number ) => p.toString()
    })
    public pages!: number;
}

@Entity()
class Chapter {

    public [PrimaryKeyProp]?: ['id', 'book'];

    @PrimaryKey()
    id!: number;

    @Property()
    title!: string;

    @ManyToOne(() => Book, {
        ref: true,
        hidden: true,
        deleteRule: 'cascade',
        primary: true,
    })
    public book!: Ref<Book>;
}


let orm: MikroORM;

beforeAll(async () => {
    orm = await MikroORM.init({
        dbName: ':memory:',
        entities: [Book, Chapter],
        debug: ['query', 'query-params'],
        allowGlobalContext: true, // only for testing
    });
    await orm.schema.refreshDatabase();
});

afterAll(async () => {
    await orm.close(true);
});

test('EntityDTO', async () => {
    const book = orm.em.create(Book, {id: 1, title: "Moby Dick", pages: 100});
    const chapter1 = orm.em.create(Chapter, {id: 1, book: book, title: "Loomings"});
    const chapter2 = orm.em.create(Chapter, {id: 2, book: book, title: "The Carpet-Bag"});
    book.chapters.add(chapter1, chapter2);
    book.currentChapter = ref(chapter1);
    await orm.em.persistAndFlush(book);
    await orm.em.flush();
    orm.em.clear();

    const b = await orm.em.findOneOrFail(Book, book.id, {
        populate: ['chapters', 'currentChapter'],
    });

    const serializedBook = wrap(book).toObject()


    // Simple property based serialization

    // Run-time type is string as expected due to the `serializer` option in the Property decorator
    expect(typeof serializedBook.pages).toBe('string')

    // Type-check wrongfully assumes type to be number
    // @ts-expect-error
    serializedBook.pages = '100'

    // Reference property based serialization

    // Run-time type is number as expected due to the `serializer` option in the ManyToOne decorator
    expect(typeof serializedBook.currentChapter).toBe('number')

    // Type-check wrongfully assumes type to be [number, number]
    // @ts-expect-error
    serializedBook.currentChapter = 3;
});
