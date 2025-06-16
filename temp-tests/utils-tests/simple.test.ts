describe('Simple Test Suite', () => {
  it('should pass a basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle string operations', () => {
    const greeting = 'Hello World';
    expect(greeting).toContain('World');
    expect(greeting.length).toBe(11);
  });

  it('should work with arrays', () => {
    const numbers = [1, 2, 3, 4, 5];
    expect(numbers).toHaveLength(5);
    expect(numbers).toContain(3);
  });

  it('should work with objects', () => {
    const user = {
      name: 'John Doe',
      age: 30,
      email: 'john@example.com',
    };

    expect(user).toHaveProperty('name');
    expect(user.name).toBe('John Doe');
    expect(user.age).toBeGreaterThan(18);
  });
});
