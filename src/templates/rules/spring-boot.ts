import { PROJECT_NAME } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Spring Boot conventions — constructor injection, JPA, security, testing, error handling
priority: medium
alwaysApply: false
managed_by: ${PROJECT_NAME}
language: java
---

# Spring Boot Conventions

## Virtual Threads (Java 21+)
- Enable virtual threads with \`spring.threads.virtual.enabled=true\` — eliminates thread-pool sizing for I/O-bound services
- Virtual threads handle thousands of concurrent requests without platform thread exhaustion
- Avoid \`synchronized\` blocks in virtual thread apps — use \`ReentrantLock\` instead; synchronized pins the carrier thread

## Dependency Injection
- Use constructor injection for all required dependencies — never \`@Autowired\` on fields
- Mark constructors with a single dependency implicitly (no annotation needed)
- Use \`@RequiredArgsConstructor\` (Lombok) to reduce boilerplate for final fields
- Keep the number of constructor parameters under 5 — more signals the class has too many responsibilities

\`\`\`java
@Service
public class OrderService {
    private final OrderRepository orderRepository;
    private final PaymentGateway paymentGateway;

    // Constructor injection — Spring autowires automatically
    public OrderService(OrderRepository orderRepository, PaymentGateway paymentGateway) {
        this.orderRepository = orderRepository;
        this.paymentGateway = paymentGateway;
    }

    @Transactional
    public Order placeOrder(CreateOrderRequest request) {
        Order order = Order.from(request);
        paymentGateway.charge(order.totalAmount());
        return orderRepository.save(order);
    }
}
\`\`\`

## REST Controllers
- Use \`@RestController\` and return \`ResponseEntity<T>\` for typed responses with status codes
- Use \`@RequestMapping\` at the class level for base path, HTTP method annotations on methods
- Validate request bodies with \`@Valid\` and Bean Validation annotations — catches bad input before it reaches business logic
- Keep controllers thin — delegate to service classes for business logic; fat controllers are untestable without HTTP

## JPA & Database
- Annotate service methods with \`@Transactional\` — not repository or controller methods
- Use \`@Transactional(readOnly = true)\` for read-only operations to enable optimizations — Hibernate skips dirty checking
- Define entity relationships carefully — prefer \`LAZY\` fetch type and load eagerly only when needed; EAGER causes N+1 by default
- Use Spring Data JPA derived queries or \`@Query\` with JPQL — avoid native SQL unless necessary

## Database Migrations
- Use Flyway or Liquibase for all schema changes — never rely on \`ddl-auto\` in production; ddl-auto can drop data
- Name migration files sequentially: \`V1__create_users.sql\`, \`V2__add_email_index.sql\`
- Test migrations against a copy of the production schema before deploying
- Never modify an already-applied migration — create a new one instead; Flyway checks checksums and will fail on mismatch

## Error Handling
- Use \`@ControllerAdvice\` with \`@ExceptionHandler\` for centralized error handling
- Return consistent error response bodies with status, message, and timestamp
- Map domain exceptions to appropriate HTTP status codes
- Log the full exception server-side, return a sanitized message to the client

\`\`\`java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(EntityNotFoundException ex) {
        var error = new ErrorResponse(404, ex.getMessage(), Instant.now());
        return ResponseEntity.status(404).body(error);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
            .map(e -> e.getField() + ": " + e.getDefaultMessage())
            .collect(Collectors.joining(", "));
        var error = new ErrorResponse(400, message, Instant.now());
        return ResponseEntity.badRequest().body(error);
    }
}
\`\`\`

## Security
- Configure security with \`SecurityFilterChain\` bean — the old \`WebSecurityConfigurerAdapter\` is deprecated
- Use method-level security (\`@PreAuthorize\`) for fine-grained access control
- Store passwords with \`BCryptPasswordEncoder\` — never store plaintext
- Disable CSRF for stateless APIs using JWT, enable it for session-based apps

## Configuration
- Use \`application.yml\` with Spring profiles: \`dev\`, \`staging\`, \`prod\`
- Externalize secrets using environment variables or Spring Cloud Config
- Use \`@ConfigurationProperties\` for type-safe configuration binding
- Validate configuration at startup with \`@Validated\` — fail fast instead of discovering missing config at runtime

## Spring Modulith
- Use Spring Modulith to enforce module boundaries in monolithic applications — verified with \`ApplicationModules.of(App.class).verify()\`
- Use application events for inter-module communication — keeps modules decoupled while maintaining transactional guarantees
- Use \`@ApplicationModuleTest\` for isolated module integration tests

## Observability
- Use Micrometer for metrics and OpenTelemetry for distributed tracing — Spring Boot auto-configures both
- Add \`spring-boot-starter-actuator\` and configure OTLP export for production observability
- Use structured logging (JSON) with correlation IDs in production

## GraalVM Native Images
- Use \`mvn -Pnative native:compile\` for native images — sub-second startup, reduced memory
- Declare reflection hints with \`@RegisterReflectionForBinding\` for classes used via reflection
- Use CDS (Class Data Sharing) as a lighter alternative when native image is too restrictive

## HTTP Clients
- Use \`RestClient\` for synchronous HTTP calls — replaces \`RestTemplate\` with a fluent, modern API
- Use \`WebClient\` for reactive/async HTTP calls
- Configure timeouts and error handling globally via \`RestClient.Builder\`

## Testing
- Use \`@SpringBootTest\` for full integration tests with the application context
- Use \`@WebMvcTest\` for controller-only tests with MockMvc
- Use \`@DataJpaTest\` for repository tests with an embedded database
- Use \`@ServiceConnection\` with Testcontainers for integration tests with real databases — replaces embedded databases
- Mock external dependencies with \`@MockBean\` — do not mock the class under test
`;
